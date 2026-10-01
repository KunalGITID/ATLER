// Finds recurring charges (likely subscriptions) in a bank statement CSV.
// Everything runs in the browser; the statement never leaves the device.
import { parseCsv } from './csv.js';
import { getLocalDateKey } from './dates.js';

// ---------- reading the statement ----------

const HEADER_HINTS = {
    date: /^(txn |transaction |value |tran )?date$|^date$/i,
    description: /narration|description|particulars|remarks|details|transaction remarks/i,
    debit: /^(debit|withdrawal|withdrawal amt\.?|withdrawals|debit amount|dr|withdrawal amount.*)$/i,
    credit: /^(credit|deposit|deposit amt\.?|deposits|credit amount|cr|deposit amount.*)$/i,
    amount: /^(amount|amount \(inr\)|txn amount|transaction amount)$/i,
    drcr: /^(dr ?\/ ?cr|cr ?\/ ?dr|type|debit\/credit)$/i,
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Indian statements write day first: 05/10/2026, 05-10-26, 05-Oct-2026, 05 Oct 26.
export function parseStatementDate(value) {
    const s = String(value || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return makeDate(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
    if (m) return makeDate(fullYear(+m[3]), +m[2] - 1, +m[1]);
    m = s.match(/^(\d{1,2})[\s/-]([A-Za-z]{3})[A-Za-z]*[\s/,-]+(\d{2}|\d{4})\b/);
    if (m && m[2].toLowerCase() in MONTHS) return makeDate(fullYear(+m[3]), MONTHS[m[2].toLowerCase()], +m[1]);
    return null;
}
const fullYear = y => (y < 100 ? 2000 + y : y);
function makeDate(y, mo, d) {
    const date = new Date(y, mo, d);
    return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

const parseMoney = v => {
    const n = parseFloat(String(v ?? '').replace(/[₹,\s]|INR|Rs\.?/gi, ''));
    return Number.isFinite(n) ? n : null;
};

// Returns debits as { date, description, amount } (amount > 0), or throws
// with a message the UI can show.
export function readStatement(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, ''));
    const headerIndex = rows.slice(0, 40).findIndex(row => {
        const cells = row.map(c => c.trim());
        return cells.some(c => HEADER_HINTS.date.test(c))
            && cells.some(c => HEADER_HINTS.description.test(c))
            && cells.some(c => HEADER_HINTS.debit.test(c) || HEADER_HINTS.amount.test(c));
    });
    if (headerIndex < 0) {
        throw new Error('Could not find the Date / Description / Debit columns. Export the statement as CSV from your bank.');
    }
    const header = rows[headerIndex].map(c => c.trim());
    const col = key => header.findIndex(c => HEADER_HINTS[key].test(c));
    const cDate = col('date');
    const cDesc = col('description');
    const cDebit = col('debit');
    const cCredit = col('credit');
    const cAmount = col('amount');
    const cDrCr = col('drcr');

    const debits = [];
    for (const row of rows.slice(headerIndex + 1)) {
        const date = parseStatementDate(row[cDate]);
        const description = String(row[cDesc] ?? '').trim();
        if (!date || !description) continue;
        let amount = null;
        if (cDebit >= 0) {
            amount = parseMoney(row[cDebit]);
        } else if (cAmount >= 0) {
            const raw = parseMoney(row[cAmount]);
            const marker = cDrCr >= 0 ? String(row[cDrCr]).trim().toLowerCase() : '';
            if (raw != null) {
                if (marker.startsWith('cr')) amount = null;
                else if (marker.startsWith('dr')) amount = Math.abs(raw);
                else amount = raw < 0 ? -raw : null; // signed amounts: debits are negative
            }
        }
        if (cCredit >= 0 && parseMoney(row[cCredit]) > 0 && !(amount > 0)) continue;
        if (amount > 0) debits.push({ date, description, amount });
    }
    if (!debits.length) throw new Error('No debit transactions found in that file.');
    return debits;
}

// ---------- naming merchants ----------

const KNOWN = [
    [/netflix/i, 'Netflix'], [/spotify/i, 'Spotify'], [/youtube|google ?youtube|yt ?premium/i, 'YouTube Premium'],
    [/prime ?video|amazon ?prime|primevideo/i, 'Amazon Prime'], [/hotstar|jiohotstar|disney/i, 'JioHotstar'],
    [/jiocinema/i, 'JioCinema'], [/sonyliv|sony ?liv/i, 'SonyLIV'], [/zee5/i, 'ZEE5'],
    [/apple\.com|itunes|apple ?services/i, 'Apple'], [/google ?(one|storage)|google ?play/i, 'Google One / Play'],
    [/openai|chatgpt/i, 'ChatGPT'], [/anthropic|claude\.ai/i, 'Claude'], [/github/i, 'GitHub'],
    [/microsoft|msft|office ?365|xbox/i, 'Microsoft'], [/adobe/i, 'Adobe'], [/canva/i, 'Canva'], [/notion/i, 'Notion'],
    [/swiggy ?one/i, 'Swiggy One'], [/zomato ?(gold|pro)/i, 'Zomato Gold'],
    [/airtel/i, 'Airtel'], [/jio(?!hotstar|cinema)/i, 'Jio'], [/\bvi\b|vodafone|idea cellular/i, 'Vi'],
    [/bsnl/i, 'BSNL'], [/act ?fibernet/i, 'ACT Fibernet'], [/tata ?play|tatasky/i, 'Tata Play'],
    [/cult\.?fit|cultfit|curefit/i, 'cult.fit'], [/linkedin/i, 'LinkedIn'], [/duolingo/i, 'Duolingo'],
    [/audible/i, 'Audible'], [/kindle/i, 'Kindle'], [/coursera/i, 'Coursera'], [/udemy/i, 'Udemy'],
];

const NOISE = /\b(upi|pos|neft|imps|rtgs|ach|nach|ecs|si|bil|onl|ib|mb|vps|vpa|txn|ref|payment|paymnt|pmt|autopay|auto ?debit|mandate|recurring|subscription|debit|card|purchase|ecom|international|intl|charges?|to|from|by|for|via|the|ltd|limited|pvt|private|india|in|com|www|online|services?|technologies|digital|media|entertainment|hdfc\w*|icic\w*|sbi\w*|axis\w*|kotak\w*|yes ?bank|paytm|phonepe|gpay|razorpay|cashfree|billdesk|payu|ccavenue)\b/gi;

export function merchantName(description) {
    const known = KNOWN.find(([re]) => re.test(description));
    if (known) return known[1];
    const words = description
        .replace(/[\w.]+@[A-Za-z.]+/g, ' ')          // UPI handles / emails
        .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, ' ')  // IFSC codes
        .replace(/[^A-Za-z\s]/g, ' ')               // digits, ref numbers, punctuation
        .replace(NOISE, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);
    if (!words.length) return null;
    return words.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ---------- spotting the pattern ----------

const DAY = 86400000;
const median = xs => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const gapDays = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);

// Billing rhythms we recognise: typical gap in days and how far a single gap
// may drift (months vary 28-31 days; banks post a day or two late).
const RHYTHMS = [
    { cycle: '7', days: 7, slack: 1 },
    { cycle: '14', days: 14, slack: 1 },
    { cycle: '28', days: 28, slack: 1 },     // prepaid mobile plans
    { cycle: 'Monthly', days: 30.4, slack: 3.5 },
    { cycle: '56', days: 56, slack: 2 },
    { cycle: '84', days: 84, slack: 3 },
    { cycle: '90', days: 90, slack: 4 },
    { cycle: '180', days: 180, slack: 7 },
    { cycle: 'Yearly', days: 365, slack: 12 },
];

// Median gap in days -> the app's cycle value, or null. 28 days on the dot is
// a 28-day plan; a monthly plan's median gap is 30-31.
export function cycleFromGap(days) {
    const hit = RHYTHMS.find(r => Math.abs(days - r.days) <= (r.cycle === 'Monthly' ? 2.5 : r.slack));
    return hit ? hit.cycle : null;
}
const rhythmOf = cycle => RHYTHMS.find(r => r.cycle === cycle);

export function findRecurring(debits, { today = new Date(), existingNames = [] } = {}) {
    const groups = new Map();
    for (const d of debits) {
        const name = merchantName(d.description);
        if (!name) continue;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(d);
    }
    const tracked = existingNames.map(n => n.toLowerCase());
    const found = [];

    for (const [name, txns] of groups) {
        txns.sort((a, b) => a.date - b.date);
        const isTracked = tracked.some(t => t.includes(name.toLowerCase()) || name.toLowerCase().includes(t));
        // Usually all of a merchant's charges are one plan (allowing a price
        // change). If not, try splitting by amount: two plans at one merchant.
        const whole = scoreSeries(name, txns, today);
        const results = whole ? [whole] : splitByAmount(txns).map(series => scoreSeries(name, series, today)).filter(Boolean);
        for (const result of results) found.push({ ...result, alreadyTracked: isTracked });
    }
    return found.sort((a, b) => b.confidence - a.confidence || b.monthlyCost - a.monthlyCost);
}

function splitByAmount(txns) {
    const buckets = [];
    for (const t of txns) {
        const bucket = buckets.find(b => Math.abs(t.amount - median(b.map(x => x.amount))) <= Math.max(2, 0.1 * t.amount));
        if (bucket) bucket.push(t); else buckets.push([t]);
    }
    return buckets.filter(b => b.length > 1);
}

function scoreSeries(name, series, today) {
    if (series.length < 2) return null;
    const gaps = series.slice(1).map((t, i) => gapDays(series[i].date, t.date));
    const cycle = cycleFromGap(median(gaps));
    if (!cycle) return null;
    if (cycle !== 'Yearly' && series.length < 3) return null; // two charges a month apart could be chance

    const { days, slack } = rhythmOf(cycle);
    const regular = gaps.filter(g => Math.abs(g - days) <= slack).length / gaps.length;
    const amounts = series.map(t => t.amount);
    const typicalAmount = median(amounts);
    const steady = amounts.filter(a => Math.abs(a - typicalAmount) <= Math.max(2, 0.1 * typicalAmount)).length / amounts.length;
    if (regular < 0.6 || steady < 0.6) return null;

    const last = series[series.length - 1];
    const period = days;
    const sinceLast = gapDays(last.date, today);
    const active = sinceLast <= period * 1.5;

    const confidence = Math.round(100 * Math.min(1, series.length / 4) * (0.5 * regular + 0.5 * steady) * (active ? 1 : 0.6));
    return {
        name,
        cycle,
        price: last.amount, // the latest charge reflects any price change
        lastCharged: getLocalDateKey(last.date),
        charges: series.length,
        active,
        confidence,
        monthlyCost: last.amount * (30.4 / period),
        samples: series.slice(-3).map(t => t.description),
    };
}
