import { describe, expect, it } from 'vitest';
import { predict, tokens, train } from './classify.ts';
import { paise } from './money.ts';
import type { Category, Payment } from './model.ts';
import { suggestCategoryId } from './suggest.ts';

describe('tokens', () => {
  it('keeps words and adds the cleaned merchant', () => {
    expect(tokens('UPI/DR/4029/ZOMATO/HDFC')).toContain('m:zomato');
    expect(tokens('Weekly veg market 250')).toEqual(['weekly', 'veg', 'market']);
  });
});

describe('predict', () => {
  const model = train([
    { name: 'Swiggy dinner', categoryId: 'food' }, { name: 'Zomato lunch', categoryId: 'food' }, { name: 'Swiggy', categoryId: 'food' },
    { name: 'Uber to office', categoryId: 'travel' }, { name: 'Ola airport', categoryId: 'travel' }, { name: 'Uber home', categoryId: 'travel' },
  ]);
  it('learns from your filing, even for names it never saw whole', () => {
    expect(predict(model, 'SWIGGY*BLR 8823')).toMatchObject({ categoryId: 'food' });
    expect(predict(model, 'uber ride late night')!.categoryId).toBe('travel');
    expect(predict(model, 'uber ride late night')!.confidence).toBeGreaterThan(0.6);
  });
  it('says nothing about words it has never seen', () => {
    expect(predict(model, 'Electricity')).toBeNull();
  });
});

describe('suggestCategoryId with the classifier', () => {
  const cats: Category[] = [{ id: 'food', name: 'Eating out', budget: null }, { id: 'travel', name: 'Getting around', budget: null }];
  const pay = (name: string, categoryId: string): Payment => ({ id: name, name, amount: paise(100), on: '2026-09-01' as Payment['on'], categoryId, source: 'manual' });
  const history = [pay('Swiggy dinner', 'food'), pay('Swiggy lunch', 'food'), pay('Uber office', 'travel'), pay('Uber home', 'travel')];
  it('uses it when no exact name matches', () => {
    expect(suggestCategoryId('Swiggy breakfast', cats, history, [])).toBe('food');
    expect(suggestCategoryId('Uber to station', cats, history, [])).toBe('travel');
  });
});
