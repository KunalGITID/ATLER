import { describe, expect, it } from 'vitest';
import { paise } from './money.ts';
import type { Category, Payment } from './model.ts';
import type { Prior } from './categoryPrior.ts';
import { priorCategoryMap, suggestCategoryId } from './suggest.ts';

const cats: Category[] = [{ id: 'food', name: 'Food', budget: null }, { id: 'treats', name: 'Treats', budget: null }];
const pay = (name: string, categoryId: string | null, on: string): Payment => ({ id: on + name, name, amount: paise(100), on: on as Payment['on'], categoryId, source: 'manual' });

describe('suggestCategoryId', () => {
  it('uses where you last filed the same name', () => {
    const history = [pay('Swiggy', 'food', '2026-09-01'), pay('swiggy ', 'treats', '2026-09-20')];
    expect(suggestCategoryId('SWIGGY', cats, history, [])).toBe('treats');
  });
  it('falls back to a keyword hint, only if you have that category', () => {
    expect(suggestCategoryId('Zomato', cats, [], [])).toBe('food');
    expect(suggestCategoryId('Uber', cats, [], [])).toBeNull();
  });
  it('ignores categories that no longer exist and very short names', () => {
    expect(suggestCategoryId('Swiggy', cats, [pay('Swiggy', 'gone', '2026-09-01')], [])).toBe('food');
    expect(suggestCategoryId('Sw', cats, [], [])).toBeNull();
  });

  describe('with a prior', () => {
    const prior: Prior = { classes: ['Food', 'Health'], bias: [0, 0], features: { 'w:bundl': [1, 3, -3], 'w:medicals': [1, -3, 3] } };
    const mine: Category[] = [{ id: 'eat', name: 'Eating out', budget: null }, { id: 'x', name: 'Misc', budget: null }];

    it('suggests from your first expense, into your own name for the category', () => {
      expect(priorCategoryMap(mine)).toEqual(new Map([['Food', 'eat']]));
      expect(suggestCategoryId('BUNDL TECHNOLOGIES', mine, [], [], prior)).toBe('eat');
    });

    it('stays quiet when you have no category for what it thinks', () => {
      expect(suggestCategoryId('Ganesh Medicals', mine, [], [], prior)).toBeNull();
    });

    it('your own filing takes over as it grows', () => {
      const filed = Array.from({ length: 300 }, (_, i) => pay(`Bundl order ${i}`, 'x', `2026-0${1 + (i % 9)}-01`));
      expect(suggestCategoryId('BUNDL TECHNOLOGIES', mine, filed.slice(0, 3), [], prior)).toBe('eat');
      expect(suggestCategoryId('BUNDL TECHNOLOGIES', mine, filed, [], prior)).toBe('x');
    });
  });
});
