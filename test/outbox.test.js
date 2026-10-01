import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOutbox, isNetworkError } from '../src/lib/outbox.js';

const memoryStore = () => {
    const data = new Map();
    return { data, get: async k => data.get(k), set: async (k, v) => { data.set(k, structuredClone(v)); } };
};
const w = n => ({ table: 'expenses', op: 'insert', values: { id: n } });

afterEach(() => vi.unstubAllGlobals());

describe('isNetworkError', () => {
    it('recognises browser fetch failures, not server rejections', () => {
        expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
        expect(isNetworkError({ message: 'Load failed' })).toBe(true);
        expect(isNetworkError({ name: 'AuthRetryableFetchError', message: '' })).toBe(true);
        expect(isNetworkError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    });

    it('anything counts as network while the browser says it is offline', () => {
        vi.stubGlobal('navigator', { onLine: false });
        expect(isNetworkError({ message: 'whatever' })).toBe(true);
    });
});

describe('outbox', () => {
    it('keeps writes per user across restarts', async () => {
        const store = memoryStore();
        const a = createOutbox({ store, run: async () => ({ error: null }) });
        await a.use('outbox:u1');
        await a.add([w(1), w(2)]);
        const b = createOutbox({ store, run: async () => ({ error: null }) });
        await b.use('outbox:u1');
        expect(b.size).toBe(2);
        await b.use('outbox:u2');
        expect(b.size).toBe(0);
    });

    it('replays in order and stops while still offline', async () => {
        const store = memoryStore();
        const ran = [];
        let online = false;
        const box = createOutbox({
            store,
            run: async x => (online || x.values.id === 1 ? (ran.push(x.values.id), { error: null }) : { error: { message: 'Failed to fetch' } }),
        });
        await box.use('k');
        await box.add([w(1), w(2), w(3)]);
        expect(await box.flush()).toEqual({ sent: 1, dropped: 0, remaining: 2 });
        online = true;
        expect(await box.flush()).toEqual({ sent: 2, dropped: 0, remaining: 0 });
        expect(ran).toEqual([1, 2, 3]);
        expect(store.data.get('k')).toEqual([]);
    });

    it('drops a write the server rejects and carries on', async () => {
        const dropped = [];
        const box = createOutbox({
            store: memoryStore(),
            run: async x => (x.values.id === 2 ? { error: { code: '23514', message: 'check constraint' } } : { error: null }),
            onDropped: (x, e) => dropped.push([x.values.id, e.code]),
        });
        await box.use('k');
        await box.add([w(1), w(2), w(3)]);
        expect(await box.flush()).toEqual({ sent: 2, dropped: 1, remaining: 0 });
        expect(dropped).toEqual([[2, '23514']]);
    });

    it('concurrent flushes share one run', async () => {
        let calls = 0;
        const box = createOutbox({ store: memoryStore(), run: async () => { calls++; return { error: null }; } });
        await box.use('k');
        await box.add([w(1)]);
        await Promise.all([box.flush(), box.flush()]);
        expect(calls).toBe(1);
    });
});
