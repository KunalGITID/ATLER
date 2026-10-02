// Which category a typed name probably belongs to. Your own history wins
// (the last time you filed "Swiggy", where did it go?). Then two models,
// blended: one trained on everything you've filed (core/classify.ts) and a
// prior trained on other people's statements (core/categoryPrior.ts), which
// is what works before you've filed much. Your filing gets more say as it
// grows: weight k / (k + 150) after k expenses (tuned in atler-ml). Only a
// confident answer is used; otherwise a keyword hint, if you have a category
// by that name.
import { priorProbabilities, type Prior } from './categoryPrior.ts';
import { probabilities, train } from './classify.ts';
import type { Category, Payment, Plan } from './model.ts';
import { suggestCategory } from './import/sms.ts';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const SURE = 0.5;
const SHRINK = 150;

// What people call the prior's categories. The prior only suggests into a
// category of yours that one of these names (or the class itself) matches.
const ALSO: Record<string, string[]> = {
  Food: ['food', 'eating out', 'restaurants', 'dining', 'meals', 'snacks', 'food & drinks', 'food and drinks'],
  Groceries: ['groceries', 'grocery', 'essentials', 'household', 'daily needs'],
  Transport: ['transport', 'travel', 'commute', 'cabs', 'fuel', 'petrol'],
  Entertainment: ['entertainment', 'fun', 'movies', 'ott', 'streaming', 'games'],
  Utilities: ['utilities', 'bills', 'recharge', 'phone', 'internet', 'electricity'],
  Shopping: ['shopping', 'clothes', 'online shopping'],
  Health: ['health', 'medical', 'medicine', 'medicines', 'fitness', 'pharmacy'],
  Education: ['education', 'college', 'study', 'studies', 'books', 'courses'],
  Productivity: ['productivity', 'software', 'tools', 'apps', 'work'],
  Transfers: ['transfers', 'transfer', 'friends', 'split', 'sent'],
};

// Prior class -> your category id, for the classes you have a category for.
export function priorCategoryMap(categories: readonly Category[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [cls, names] of Object.entries(ALSO)) {
    const hit = categories.find(c => names.includes(key(c.name)));
    if (hit) map.set(cls, hit.id);
  }
  return map;
}

export function suggestCategoryId(name: string, categories: Category[], payments: Payment[], plans: Plan[], prior: Prior | null = null): string | null {
  const k = key(name);
  if (k.length < 3) return null;
  const alive = new Set(categories.map(c => c.id));
  const filed = [...payments.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.on })),
    ...plans.map(p => ({ name: p.name, categoryId: p.categoryId, when: p.anchor }))]
    .filter((x): x is typeof x & { categoryId: string } => !!x.categoryId && alive.has(x.categoryId));
  const past = filed.filter(x => key(x.name) === k).sort((a, b) => (a.when < b.when ? 1 : -1));
  if (past[0]) return past[0].categoryId;

  const yours = filed.length ? probabilities(train(filed), name) : null;
  const theirs = new Map<string, number>();
  const fromPrior = prior && priorProbabilities(prior, name);
  if (fromPrior) {
    for (const [cls, id] of priorCategoryMap(categories)) theirs.set(id, (theirs.get(id) ?? 0) + fromPrior.get(cls)!);
  }
  if (yours || theirs.size) {
    const w = !yours ? 0 : !theirs.size ? 1 : filed.length / (filed.length + SHRINK);
    const ids = new Set([...(yours?.keys() ?? []), ...theirs.keys()]);
    const blended = [...ids].map(id => [id, w * (yours?.get(id) ?? 0) + (1 - w) * (theirs.get(id) ?? 0)] as const);
    const [best, p] = blended.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (p >= SURE) return best;
  }
  const hint = suggestCategory(name);
  return (hint && categories.find(c => key(c.name) === key(hint))?.id) || null;
}
