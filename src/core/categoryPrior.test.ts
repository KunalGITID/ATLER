import { describe, expect, it } from 'vitest';
import shipped from './categoryPrior.json';
import { priorProbabilities, priorTokens, type Prior } from './categoryPrior.ts';

describe('priorTokens', () => {
  it('letters only, a word token and the 3-5 character n-grams of " word "', () => {
    expect(priorTokens('UPI/DR/123/Go')).toEqual(['w:upi', ' up', 'upi', 'pi ', ' upi', 'upi ', ' upi ', 'w:dr', ' dr', 'dr ', ' dr ', 'w:go', ' go', 'go ', ' go ']);
    expect(priorTokens('a 1 *')).toEqual([]);
  });
});

describe('priorProbabilities', () => {
  const prior: Prior = { classes: ['Food', 'Travel'], bias: [0, 0], features: { 'w:swiggy': [1, 2, -2], 'w:uber': [1, -2, 2] } };
  it('softmax over the known features; null when nothing is known', () => {
    const p = priorProbabilities(prior, 'SWIGGY order')!;
    expect(p.get('Food')).toBeCloseTo(1 / (1 + Math.exp(-4)), 6);
    expect(priorProbabilities(prior, 'Corner shop')).toBeNull();
  });

  it('the shipped prior knows legal names that keyword rules miss', () => {
    const top = (t: string) => [...priorProbabilities(shipped as Prior, t)!].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    expect(top('UPI/DR/951992534445/BUNDL TECHNOLOGIES/HDFC/bundl@ybl')).toBe('Food'); // Swiggy
    expect(top('POS 4111XXXXXX1111 KIRANAKART TECHNOLOGIES CHENNAI')).toBe('Groceries'); // Zepto
    expect(top('UPI/123/Paid to SRI GANESH MEDICALS/ganesh@ybl')).toBe('Health');
  });
});
