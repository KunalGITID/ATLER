// Which category a typed name probably belongs to. Your own history wins
// (the last time you filed "Swiggy", where did it go?); otherwise a keyword
// hint, but only if you have a category by that name.
import type { Category, Payment, Plan } from './model.ts';
import { suggestCategory } from './import/sms.ts';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function suggestCategoryId(name: string, categories: Category[], payments: Payment[], plans: Plan[]): string | null {
  const k = key(name);
  if (k.length < 3) return null;
  const alive = new Set(categories.map(c => c.id));
  const past = [...payments.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.on })),
    ...plans.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.anchor }))]
    .filter(x => x.categoryId && alive.has(x.categoryId) && key(x.name) === k)
    .sort((a, b) => (a.when < b.when ? 1 : -1));
  if (past[0]) return past[0].categoryId;
  const hint = suggestCategory(name);
  return (hint && categories.find(c => key(c.name) === key(hint))?.id) || null;
}
