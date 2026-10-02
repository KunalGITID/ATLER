// A small stand-in for the Supabase REST and Auth APIs, just enough for the
// calls src/main.js makes. Any email/password signs in to one test account.
//   POST /__reset          wipe all tables
//   POST /__seed           body { table: [rows] } -> insert rows
//   POST /__fail?table=x   the next write to table x answers 500
//   GET  /__db             dump everything (for assertions)
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 54329);
const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const TABLES = ['profiles', 'subscriptions', 'categories', 'expenses', 'push_subscriptions', 'sent_reminders', 'price_changes', 'error_log',
    // v2 synced tables: the mock mirrors the real trigger (revision + last edit wins)
    'plans', 'plan_events', 'payments', 'spend_categories', 'incomes', 'goals'];
const SYNCED = new Set(['plans', 'plan_events', 'payments', 'spend_categories', 'incomes', 'goals']);
let revision = 0;
const PRIMARY_KEY = {
    profiles: ['user_id'],
    push_subscriptions: ['endpoint'],
    sent_reminders: ['subscription_id', 'renewal_date', 'days_before'],
};

let db = Object.fromEntries(TABLES.map(t => [t, []]));
let offline = false;
let accountDeleted = false;
const failNext = new Set();

function matchesOne(row, key, raw) {
    const [op, ...rest] = raw.split('.');
    const value = rest.join('.');
    const cell = row[key] == null ? null : String(row[key]);
    if (op === 'is') return value === 'null' ? cell === null : String(cell) === value;
    if (op === 'not') return !matchesOne(row, key, value);
    return matches(row, [[key, raw]]);
}

function matches(row, params) {
    for (const [key, raw] of params) {
        if (['select', 'on_conflict', 'order', 'columns', 'limit'].includes(key)) continue;
        if (key === 'or') {
            // or=(a.op.value,b.op.value): any one condition is enough
            const parts = raw.replace(/^\(|\)$/g, '').split(',');
            if (!parts.some(p => { const [k, ...r] = p.split('.'); return matchesOne(row, k, r.join('.')); })) return false;
            continue;
        }
        if (raw.startsWith('is.') || raw.startsWith('not.')) {
            if (!matchesOne(row, key, raw)) return false;
            continue;
        }
        const [op, ...rest] = raw.split('.');
        const value = rest.join('.');
        const cell = row[key] == null ? null : String(row[key]);
        if (op === 'eq' && cell !== value) return false;
        if (op === 'neq' && cell === value) return false;
        if (op === 'gt' && !(Number(cell) > Number(value))) return false;
        if (op === 'in' && !value.replace(/^\(|\)$/g, '').split(',').map(v => v.replace(/^"|"$/g, '')).includes(cell)) return false;
        if (op === 'like') {
            const re = new RegExp('^' + value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$');
            if (!re.test(cell ?? '')) return false;
        }
    }
    return true;
}

// Profile changes (updateUser) and stored files (the avatars bucket).
let userMeta = {};
const files = new Map();

function session(email = 'test@atler.mock') {
    return {
        access_token: `mock-access.${USER_ID}`,
        refresh_token: `mock-refresh.${USER_ID}`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
            id: USER_ID, aud: 'authenticated', role: 'authenticated', email,
            app_metadata: { provider: 'email' }, user_metadata: { name: 'Test User', ...userMeta },
            created_at: new Date().toISOString(),
        },
    };
}

const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-expose-headers', 'content-range');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const url = new URL(req.url, 'http://mock');
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const isJson = (req.headers['content-type'] ?? 'application/json').includes('json');
        const body = bytes.length && isJson ? JSON.parse(bytes.toString()) : null;
        const send = (code, data) => {
            res.writeHead(code, { 'content-type': 'application/json' });
            res.end(data === undefined ? '' : JSON.stringify(data));
        };

        if (url.pathname === '/__reset') { db = Object.fromEntries(TABLES.map(t => [t, []])); failNext.clear(); revision = 0; offline = false; accountDeleted = false; userMeta = {}; files.clear(); return send(204); }
        if (url.pathname === '/__offline') { offline = url.searchParams.get('on') === '1'; return send(204); }
        if (url.pathname === '/__seed') {
            for (const [t, rows] of Object.entries(body)) db[t].push(...rows.map(r => ({ user_id: USER_ID, ...r })));
            return send(204);
        }
        if (url.pathname === '/__fail') { failNext.add(url.searchParams.get('table')); return send(204); }
        if (url.pathname === '/__db') return send(200, db);

        if (url.pathname === '/functions/v1/delete-account') {
            db = Object.fromEntries(TABLES.map(t => [t, []]));
            accountDeleted = true;
            return send(200, { deleted: true });
        }
        if (url.pathname === '/__account') return send(200, { deleted: accountDeleted });
        const publicFile = url.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
        if (publicFile) {
            const f = files.get(publicFile[1]);
            if (!f) return send(404);
            res.writeHead(200, { 'content-type': f.type });
            return res.end(f.bytes);
        }
        if (url.pathname === '/storage/v1/object/avatars' && req.method === 'DELETE') {
            for (const p of body?.prefixes ?? []) files.delete(`avatars/${p}`);
            return send(200, []);
        }
        const upload = url.pathname.match(/^\/storage\/v1\/object\/(avatars\/.+)$/);
        if (upload && (req.method === 'POST' || req.method === 'PUT')) {
            files.set(upload[1], { bytes, type: req.headers['content-type'] ?? 'application/octet-stream' });
            return send(200, { Key: upload[1] });
        }
        if (url.pathname === '/__files') return send(200, [...files.keys()]);
        if (url.pathname.startsWith('/auth/v1/')) {
            if (url.pathname.endsWith('/logout')) return send(204);
            if (url.pathname.endsWith('/user')) {
                if (req.method === 'PUT' && body?.data) userMeta = { ...userMeta, ...body.data };
                return send(200, session().user);
            }
            return send(200, session(body?.email));
        }

        if (offline && url.pathname.startsWith('/rest/')) { req.socket.destroy(); return; }
        const table = url.pathname.replace(/^\/rest\/v1\//, '');
        if (!TABLES.includes(table)) return send(404, { message: `relation "${table}" does not exist` });
        const single = (req.headers.accept || '').includes('vnd.pgrst.object');

        if (req.method !== 'GET' && failNext.delete(table)) {
            return send(500, { code: 'XX000', message: 'mock failure' });
        }

        if (req.method === 'GET') {
            let rows = db[table].filter(r => matches(r, url.searchParams));
            const order = url.searchParams.get('order');
            if (order) {
                const [col, dir] = order.split('.');
                rows = [...rows].sort((a, b) => (Number(a[col]) - Number(b[col])) * (dir === 'desc' ? -1 : 1));
            }
            const limit = Number(url.searchParams.get('limit'));
            if (limit) rows = rows.slice(0, limit);
            if (single) return rows.length === 1 ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
            return send(200, rows);
        }
        if (req.method === 'POST') {
            const rows = Array.isArray(body) ? body : [body];
            const prefer = req.headers.prefer || '';
            const key = PRIMARY_KEY[table] || ['id'];
            for (const row of rows) {
                const hit = db[table].find(r => key.every(k => String(r[k]) === String(row[k])));
                if (SYNCED.has(table)) {
                    const stored = { user_id: USER_ID, ...row };
                    if (hit && Number(row.updated_at) < Number(hit.updated_at)) continue; // older edit loses
                    stored.revision = ++revision;
                    if (hit) Object.assign(hit, stored); else db[table].push(stored);
                    continue;
                }
                if (hit && prefer.includes('ignore-duplicates')) continue;
                if (hit && prefer.includes('merge-duplicates')) { Object.assign(hit, row); continue; }
                if (hit) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
                db[table].push({ ...row });
            }
            return send(201);
        }
        if (req.method === 'PATCH') {
            db[table].filter(r => matches(r, url.searchParams)).forEach(r => Object.assign(r, body));
            return send(204);
        }
        if (req.method === 'DELETE') {
            db[table] = db[table].filter(r => !matches(r, url.searchParams));
            return send(204);
        }
        send(405, { message: 'not implemented in the mock' });
    });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock supabase on http://127.0.0.1:${PORT}`));
