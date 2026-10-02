// Reads a bank statement (CSV) into debits. Subscriptions in it are found
// by ./recurring.ts. Runs on the phone; the statement is never uploaded.
import { makeDay, type Day } from '../dates.ts';
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

// ---------- naming merchants: ./merchants.ts ----------

export { knownMerchant, merchantName } from './merchants.ts';
