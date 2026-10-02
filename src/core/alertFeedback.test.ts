import { describe, expect, it } from 'vitest';
import { alertTrackRecord, barFor, DEFAULT_BAR, learnBars, type Verdict } from './alertFeedback.ts';

const v = (times: number, expected: boolean, merchant = 'swiggy', i = Math.random()): Verdict =>
  ({ paymentId: `p${times}-${i}`, merchant, times, expected, at: 0 });

describe('learnBars', () => {
  it('stays at 2x until there are a few answers', () => {
    expect(learnBars([]).user).toBe(DEFAULT_BAR);
    expect(learnBars([v(2.4, true, 'a'), v(2.8, true, 'b'), v(3, true, 'c')]).user).toBe(DEFAULT_BAR);
  });

  it('moves just above what you called expected, towards what you called real', () => {
    const answers = [v(2.2, true, 'a'), v(2.5, true, 'b'), v(2.6, true, 'c'), v(3, true, 'd'), v(6, false, 'e')];
    const { user } = learnBars(answers);
    expect(user).toBeGreaterThan(2.9);
    expect(user).toBeLessThan(6);
    // halfway (geometrically) from 2.88 (90th percentile of expected) to 6: about 4.2
    expect(user).toBeCloseTo(Math.sqrt(2.88 * 6), 1);
    // so a 3x jump is no longer flagged, a 5x one still is
    expect(barFor(learnBars(answers), 'x')).toBeGreaterThan(3);
    expect(barFor(learnBars(answers), 'x')).toBeLessThan(5);
  });

  it('never goes below 2x, even if you call everything real', () => {
    expect(learnBars([v(2.1, false), v(2.2, false), v(2.3, false), v(2.4, false)]).user).toBe(DEFAULT_BAR);
  });

  it('a place you called expected gets its own, higher bar, unless you called a smaller jump there real', () => {
    const bars = learnBars([v(5, true, 'amazon')]);
    expect(barFor(bars, 'amazon')).toBeCloseTo(6.25);
    expect(barFor(bars, 'swiggy')).toBe(DEFAULT_BAR);
    expect(barFor(learnBars([v(5, true, 'amazon'), v(4, false, 'amazon')]), 'amazon')).toBe(4);
  });
});

describe('alertTrackRecord', () => {
  it('how many answered alerts were really unusual', () => {
    expect(alertTrackRecord([])).toBeNull();
    expect(alertTrackRecord([v(3, true), v(5, false), v(6, false), v(7, false)])).toEqual({ answered: 4, real: 3, precision: 0.75 });
  });
});
