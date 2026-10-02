// Text read off a photographed bill or a UPI payment screenshot -> an
// expense. The text comes from OCR on the phone (data/ocr.ts); this part is
// pure and tested. OCR text is noisy, so each field has fallbacks.
import type { Day } from '../dates.ts';
import { paise, type Paise } from '../money.ts';
import { knownMerchant, merchantName, parseStatementDate } from './statement.ts';
import { suggestCategory } from './sms.ts';

export interface ReceiptGuess { name: string | null; amount: Paise | null; on: Day | null; category: string | null }

const MONEY = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?/gi;
const TOTAL = /\b(grand\s*total|net\s*(?:amount|payable|total)|total\s*(?:amount|payable|due)?|amount\s*(?:paid|payable)|bill\s*amount|to\s*pay|paid)\b/i;
const SKIP_TOTAL = /\b(sub\s*-?\s*total|total\s*(?:items?|qty|quantity|savings?|discount|tax|gst)|discount|savings)\b/i;
const DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,9}[\s,-]+\d{2,4})\b/;
const NOT_A_NAME = /tax invoice|invoice|receipt|bill of supply|gstin|cash memo|original|duplicate|welcome|thank|phone|tel|mob|date|time|order|table|^\W*$/i;

// Money-looking numbers in a line, in paise. Long bare digit runs (phone
// numbers, bill and transaction IDs) are skipped unless marked as money.
function amounts(line: string): number[] {
  return [...line.matchAll(MONEY)]
    .filter(m => /[₹]|rs|inr/i.test(m[0]) || m[2] !== undefined || m[1]!.replace(/,/g, '').length <= 7)
    .map(m => Number(m[1]!.replace(/,/g, '')) * 100 + Number((m[2] ?? '').padEnd(2, '0')));
}

export function parseReceipt(text: string): ReceiptGuess {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

  // Amount: a UPI screenshot's big "₹250" or "Paid ₹250"; else the last
  // "total" line on a bill (grand total comes after subtotal); else the largest.
  let amount: number | null = null;
  const upi = text.match(/(?:paid|sent|payment of|amount)\s*(?:successfully\s*)?(?:to\s+[^\n₹]*?)?\s*₹\s*([\d,]+(?:\.\d{1,2})?)/i) ?? text.match(/^\s*₹\s*([\d,]+(?:\.\d{1,2})?)\s*$/m);
  if (upi) amount = Math.round(Number(upi[1]!.replace(/,/g, '')) * 100);
  if (amount === null) {
    for (const line of lines) {
      if (!TOTAL.test(line) || SKIP_TOTAL.test(line)) continue;
      const found = amounts(line).filter(a => a > 0);
      if (found.length) amount = found[found.length - 1]!;
    }
  }
  if (amount === null) {
    const all = lines.filter(l => !DATE.test(l)).flatMap(amounts).filter(a => a > 0 && a < 10_000_000);
    if (all.length) amount = Math.max(...all);
  }

  // Date: the first date-looking text.
  const dateText = text.match(DATE)?.[1];
  const on = dateText ? parseStatementDate(dateText.replace(/\s+/g, '-')) : null;

  // Name: who was paid on a UPI screen, a merchant ATLER knows, or the
  // bill's first line that reads like a shop name.
  const paidTo = text.match(/(?:paid to|sent to|to:)\s*\n?\s*([^\n]+)/i)?.[1]?.trim();
  const known = knownMerchant(text);
  const header = lines.slice(0, 5).find(l => /[A-Za-z]{3}/.test(l) && !NOT_A_NAME.test(l) && !/\d{4,}/.test(l));
  const name = (paidTo && (merchantName(paidTo) ?? paidTo.slice(0, 40))) || known || (header ? header.slice(0, 40) : null);

  return { name, amount: amount !== null ? paise(amount) : null, on, category: suggestCategory(text) };
}
