// Money is always an integer number of paise (₹1 = 100). Never a float, never
// a string: ₹199.00 is 19900. Convert at the edges only (input, display).

export type Paise = number & { readonly __paise: unique symbol };

export function paise(n: number): Paise {
  if (!Number.isSafeInteger(n)) throw new Error(`paise must be a whole number, got ${n}`);
  return n as Paise;
}

// "199", "199.5", "1,499.00", "₹ 85" -> paise. null for anything else.
export function parseRupees(text: string): Paise | null {
  const cleaned = String(text).replace(/[₹,\s]|rs\.?|inr/gi, '');
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return paise(whole * 100 + fraction);
}

export const sum = (values: readonly Paise[]): Paise => paise(values.reduce((a, b) => a + b, 0));

const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const formatterExact = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ₹2,186 for whole rupees, ₹199.50 when there are paise; `exact` forces .00.
export function formatRupees(value: Paise, { exact = false, sign = false } = {}): string {
  const abs = Math.abs(value) / 100;
  const body = exact || abs % 1 !== 0 ? formatterExact.format(abs) : formatter.format(abs);
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  return `${prefix}₹${body}`;
}
