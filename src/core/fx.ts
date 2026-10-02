// Prices in other currencies. ATLER counts rupees; a foreign price is kept
// alongside so you see what you're billed ($20) and what it costs (₹1,712).
// The rate is yours to set (your card's rate, roughly): no rates service.
import { paise, type Paise } from './money.ts';
import { CURRENCIES, type Currency, type Foreign } from './model.ts';

const decimals = (c: Currency) => (c === 'JPY' ? 0 : 2);

export const isCurrency = (s: string): s is Currency => (CURRENCIES as readonly string[]).includes(s);

// "20", "19.99" in `currency` -> its minor units, or null.
export function parseForeign(text: string, currency: Currency): number | null {
  const m = String(text).replace(/[,\s]/g, '').match(decimals(currency) ? /^(\d+)(?:\.(\d{1,2}))?$/ : /^(\d+)$/);
  if (!m) return null;
  return decimals(currency) ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : Number(m[1]);
}

// "83.5" -> 83.5 rupees per unit, or null.
export function parseRate(text: string): number | null {
  const m = String(text).replace(/[,\s₹]/g, '').match(/^(\d+)(?:\.(\d{1,4}))?$/);
  const n = m ? Number(`${m[1]}.${m[2] ?? '0'}`) : NaN;
  return n > 0 && n < 100000 ? n : null;
}

export function toRupees(f: Foreign, rate: number): Paise {
  const major = f.amount / 10 ** decimals(f.currency);
  return paise(Math.round(major * rate * 100));
}

// The rate a stored foreign price implies (to prefill an edit).
export const impliedRate = (f: Foreign, inr: Paise) => {
  const major = f.amount / 10 ** decimals(f.currency);
  return major > 0 ? Math.round((inr / 100 / major) * 100) / 100 : null;
};

export function formatForeign(f: Foreign): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: f.currency, minimumFractionDigits: 0, maximumFractionDigits: decimals(f.currency) })
    .format(f.amount / 10 ** decimals(f.currency));
}

export const foreignText = (f: Foreign) => (f.amount / 10 ** decimals(f.currency)).toString();
