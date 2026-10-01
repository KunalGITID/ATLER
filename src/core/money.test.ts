import { describe, expect, it } from 'vitest';
import { formatRupees, paise, parseRupees, sum } from './money.ts';

describe('money', () => {
  it('parses what people type into paise', () => {
    expect(parseRupees('199')).toBe(19900);
    expect(parseRupees('199.5')).toBe(19950);
    expect(parseRupees('₹ 1,499.00')).toBe(149900);
    expect(parseRupees('Rs.85')).toBe(8500);
    expect(parseRupees('1.999')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
  });

  it('never accepts fractional paise', () => {
    expect(() => paise(0.5)).toThrow();
  });

  it('adds exactly (no float drift)', () => {
    expect(sum([paise(10), paise(20)])).toBe(30); // 0.1 + 0.2 in rupees
  });

  it('formats like an Indian price tag', () => {
    expect(formatRupees(paise(218600))).toBe('₹2,186');
    expect(formatRupees(paise(19950))).toBe('₹199.50');
    expect(formatRupees(paise(19900), { exact: true })).toBe('₹199.00');
    expect(formatRupees(paise(-24000))).toBe('−₹240');
    expect(formatRupees(paise(24000), { sign: true })).toBe('+₹240');
    expect(formatRupees(paise(12345678))).toBe('₹1,23,456.78');
  });
});
