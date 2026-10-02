import { describe, expect, it } from 'vitest';
import { paise } from './money.ts';
import type { Category, Payment } from './model.ts';
import { suggestCategoryId } from './suggest.ts';

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
});
