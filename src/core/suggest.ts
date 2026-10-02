// Which category a typed name probably belongs to. Your own history wins
// (the last time you filed "Swiggy", where did it go?); then a classifier
// trained on everything you've filed (core/classify.ts), when it's sure;
// otherwise a keyword hint, but only if you have a category by that name.
import { predict, train } from './classify.ts';
import type { Category, Payment, Plan } from './model.ts';
import { suggestCategory } from './import/sms.ts';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const SURE = 0.6;

export function suggestCategoryId(name: string, categories: Category[], payments: Payment[], plans: Plan[]): string | null {
  const k = key(name);
  if (k.length < 3) return null;
  const alive = new Set(categories.map(c => c.id));
  const filed = [...payments.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.on })),
    ...plans.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.anchor }))]
    .filter((x): x is typeof x & { categoryId: string } => !!x.categoryId && alive.has(x.categoryId));
  const past = filed.filter(x => key(x.name) === k).sort((a, b) => (a.when < b.when ? 1 : -1));
  if (past[0]) return past[0].categoryId;
  const guess = predict(train(filed), name);
  if (guess && guess.confidence >= SURE) return guess.categoryId;
  const hint = suggestCategory(name);
  return (hint && categories.find(c => key(c.name) === key(hint))?.id) || null;
}
