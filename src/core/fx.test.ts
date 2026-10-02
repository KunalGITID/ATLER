import { describe, expect, it } from 'vitest';
import { paise } from './money.ts';
import { formatForeign, impliedRate, parseForeign, parseRate, toRupees } from './fx.ts';

describe('foreign prices', () => {
  it('parses amounts in minor units, yen without decimals', () => {
    expect(parseForeign('19.99', 'USD')).toBe(1999);
    expect(parseForeign('20', 'EUR')).toBe(2000);
    expect(parseForeign('1500', 'JPY')).toBe(1500);
    expect(parseForeign('15.5', 'JPY')).toBeNull();
    expect(parseForeign('abc', 'USD')).toBeNull();
  });
  it('converts at your rate, and back', () => {
    expect(parseRate('85.62')).toBe(85.62);
    expect(parseRate('0')).toBeNull();
    const usd = { currency: 'USD' as const, amount: 2000 };
    expect(toRupees(usd, 85.62)).toBe(171240);
    expect(impliedRate(usd, paise(171240))).toBe(85.62);
    expect(toRupees({ currency: 'JPY', amount: 1500 }, 0.58)).toBe(87000);
  });
  it('shows the billed price', () => {
    expect(formatForeign({ currency: 'USD', amount: 2000 })).toMatch(/^(US)?\$20$/); // ICU versions differ
    expect(formatForeign({ currency: 'EUR', amount: 999 })).toBe('€9.99');
  });
});
