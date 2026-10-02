// Finds recurring charges (likely subscriptions) in a bank statement.
// Runs on the phone; the statement is never uploaded.
import { daysBetween, makeDay, monthlyCost, type Cycle, type Day } from '../dates.ts';
import { paise, type Paise } from '../money.ts';
import { parseCsv } from './csv.ts';

export interface Debit { on: Day; description: string; amount: Paise }

// ---------- reading the statement ----------

const HEADER = {
  date: /^(txn |transaction |value |tran )?date$|^date$/i,
  description: /narration|description|particulars|remarks|details|transaction remarks/i,
  debit: /^(debit|withdrawal|withdrawal amt\.?|withdrawals|debit amount|dr|withdrawal amount.*)$/i,
  credit: /^(credit|deposit|deposit amt\.?|deposits|credit amount|cr|deposit amount.*)$/i,
  amount: /^(amount|amount \(inr\)|txn amount|transaction amount)$/i,
  drcr: /^(dr ?\/ ?cr|cr ?\/ ?dr|type|debit\/credit)$/i,
} as const;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

// Indian statements write the day first: 05/10/2026, 05-10-26, 05-Oct-2026, 05 Oct 26.
export function parseStatementDate(value: unknown): Day | null {
  const s = String(value ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return makeDay(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) return makeDay(fullYear(+m[3]!), +m[2]!, +m[1]!);
  m = s.match(/^(\d{1,2})[\s/-]([A-Za-z]{3})[A-Za-z]*[\s/,-]+(\d{2}|\d{4})\b/);
  const month = m ? MONTHS[m[2]!.toLowerCase()] : undefined;
  if (m && month) return makeDay(fullYear(+m[3]!), month, +m[1]!);
  return null;
}

// A money cell -> signed paise, or null. "1,499.00", "₹ 85", "-119", "INR 250".
export function moneyCell(value: unknown): number | null {
  const s = String(value ?? '').replace(/[₹,\s]|INR|Rs\.?/gi, '');
  const m = s.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const n = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -n : n;
}

export function readStatement(text: string): Debit[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const headerIndex = rows.slice(0, 40).findIndex(row => {
    const cells = row.map(c => c.trim());
    return cells.some(c => HEADER.date.test(c)) && cells.some(c => HEADER.description.test(c))
      && cells.some(c => HEADER.debit.test(c) || HEADER.amount.test(c));
  });
  if (headerIndex < 0) throw new Error('Could not find the Date / Description / Debit columns. Export the statement as CSV or PDF from your bank.');
  const header = rows[headerIndex]!.map(c => c.trim());
  const col = (key: keyof typeof HEADER) => header.findIndex(c => HEADER[key].test(c));
  const [cDate, cDesc, cDebit, cCredit, cAmount, cDrCr] = [col('date'), col('description'), col('debit'), col('credit'), col('amount'), col('drcr')];

  const debits: Debit[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const on = parseStatementDate(row[cDate]);
    const description = String(row[cDesc] ?? '').trim();
    if (!on || !description) continue;
    let amount: number | null = null;
    if (cDebit >= 0) {
      amount = moneyCell(row[cDebit]);
    } else if (cAmount >= 0) {
      const raw = moneyCell(row[cAmount]);
      const marker = cDrCr >= 0 ? String(row[cDrCr] ?? '').trim().toLowerCase() : '';
      if (raw !== null) {
        if (marker.startsWith('cr')) amount = null;
        else if (marker.startsWith('dr')) amount = Math.abs(raw);
        else amount = raw < 0 ? -raw : null; // signed amounts: debits are negative
      }
    }
    if (cCredit >= 0 && (moneyCell(row[cCredit]) ?? 0) > 0 && !(amount !== null && amount > 0)) continue;
    if (amount !== null && amount > 0) debits.push({ on, description, amount: paise(amount) });
  }
  if (!debits.length) throw new Error('No debit transactions found in that file.');
  return debits;
}

// ---------- naming merchants ----------

const KNOWN: Array<[RegExp, string]> = [
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

export function merchantName(description: string): string | null {
  const known = KNOWN.find(([re]) => re.test(description));
  if (known) return known[1];
  const words = description
    .replace(/[\w.]+@[A-Za-z.]+/g, ' ')         // UPI handles / emails
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, ' ')  // IFSC codes
    .replace(/[^A-Za-z\s]/g, ' ')              // digits, reference numbers, punctuation
    .replace(NOISE, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  if (!words.length) return null;
  return words.slice(0, 2).map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ---------- spotting the pattern ----------

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

// Billing rhythms: the typical gap in days, how far one gap may drift (months
// vary 28-31 days; banks post a day or two late), and the cycle it means.
const RHYTHMS: Array<{ days: number; slack: number; match: number; cycle: Cycle }> = [
  { days: 7, slack: 1, match: 1, cycle: { unit: 'day', every: 7 } },
  { days: 14, slack: 1, match: 1, cycle: { unit: 'day', every: 14 } },
  { days: 28, slack: 1, match: 1, cycle: { unit: 'day', every: 28 } }, // prepaid mobile
  { days: 30.4, slack: 3.5, match: 2.5, cycle: { unit: 'month', every: 1 } },
  { days: 56, slack: 2, match: 2, cycle: { unit: 'day', every: 56 } },
  { days: 84, slack: 3, match: 3, cycle: { unit: 'day', every: 84 } },
  { days: 91.3, slack: 5, match: 4, cycle: { unit: 'month', every: 3 } },
  { days: 182.6, slack: 8, match: 7, cycle: { unit: 'month', every: 6 } },
  { days: 365, slack: 12, match: 12, cycle: { unit: 'year', every: 1 } },
];

// Median gap -> a cycle, or null. 28 days on the dot is a 28-day plan; a
// monthly plan's median gap is 30-31.
export function cycleFromGap(days: number): Cycle | null {
  return RHYTHMS.find(r => Math.abs(days - r.days) <= r.match)?.cycle ?? null;
}

export interface Found {
  name: string;
  cycle: Cycle;
  price: Paise;         // the latest charge, so a price change is reflected
  lastCharged: Day;
  charges: number;
  active: boolean;      // charged within 1.5 cycles of today
  confidence: number;   // 0-100
  perMonth: Paise;
  alreadyTracked: boolean;
}

function scoreSeries(name: string, series: Debit[], today: Day): Omit<Found, 'alreadyTracked'> | null {
  if (series.length < 2) return null;
  const gaps = series.slice(1).map((t, i) => daysBetween(series[i]!.on, t.on));
  const rhythm = RHYTHMS.find(r => Math.abs(median(gaps) - r.days) <= r.match);
  if (!rhythm) return null;
  if (rhythm.cycle.unit !== 'year' && series.length < 3) return null; // two charges a month apart could be chance

  const regular = gaps.filter(g => Math.abs(g - rhythm.days) <= rhythm.slack).length / gaps.length;
  const amounts = series.map(t => t.amount as number);
  const typical = median(amounts);
  const steady = amounts.filter(a => Math.abs(a - typical) <= Math.max(200, 0.1 * typical)).length / amounts.length;
  if (regular < 0.6 || steady < 0.6) return null;

  const last = series[series.length - 1]!;
  const active = daysBetween(last.on, today) <= rhythm.days * 1.5;
  return {
    name,
    cycle: rhythm.cycle,
    price: last.amount,
    lastCharged: last.on,
    charges: series.length,
    active,
    confidence: Math.round(100 * Math.min(1, series.length / 4) * (0.5 * regular + 0.5 * steady) * (active ? 1 : 0.6)),
    perMonth: monthlyCost(last.amount, rhythm.cycle),
  };
}

function splitByAmount(txns: Debit[]): Debit[][] {
  const buckets: Debit[][] = [];
  for (const t of txns) {
    const bucket = buckets.find(b => Math.abs(t.amount - median(b.map(x => x.amount))) <= Math.max(200, 0.1 * t.amount));
    if (bucket) bucket.push(t); else buckets.push([t]);
  }
  return buckets.filter(b => b.length > 1);
}

export function findRecurring(debits: readonly Debit[], today: Day, existingNames: readonly string[] = []): Found[] {
  const groups = new Map<string, Debit[]>();
  for (const d of debits) {
    const name = merchantName(d.description);
    if (!name) continue;
    groups.set(name, [...(groups.get(name) ?? []), d]);
  }
  const tracked = existingNames.map(n => n.toLowerCase());
  const found: Found[] = [];
  for (const [name, txns] of groups) {
    txns.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
    const isTracked = tracked.some(t => t.includes(name.toLowerCase()) || name.toLowerCase().includes(t));
    // Usually all of a merchant's charges are one plan (allowing a price
    // change). If not, try splitting by amount: two plans at one merchant.
    const whole = scoreSeries(name, txns, today);
    const results = whole ? [whole] : splitByAmount(txns).map(s => scoreSeries(name, s, today)).filter(x => x !== null);
    for (const r of results) found.push({ ...r, alreadyTracked: isTracked });
  }
  return found.sort((a, b) => b.confidence - a.confidence || b.perMonth - a.perMonth);
}
