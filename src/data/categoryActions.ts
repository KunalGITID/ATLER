import type { Paise } from '../core/money.ts';
import type { Category } from '../core/model.ts';
import { newId, type AtlerDB } from './db.ts';
import { touched } from './touch.ts';


export async function addCategory(db: AtlerDB, name: string, budget: Paise | null = null): Promise<Category> {
  const category: Category = { id: newId(), name: name.trim(), budget };
  await db.categories.add({ ...category, ...touched() });
  return category;
}

export async function updateCategory(db: AtlerDB, id: string, changes: { name: string; budget: Paise | null }) {
  await db.categories.update(id, { name: changes.name.trim(), budget: changes.budget, ...touched() });
}

// Plans and expenses in it become uncategorised; nothing is lost.
export async function deleteCategory(db: AtlerDB, id: string) {
  await db.transaction('rw', db.categories, db.plans, db.payments, async () => {
    await db.plans.where('id').anyOf((await db.plans.toArray()).filter(p => p.categoryId === id).map(p => p.id)).modify({ categoryId: null, ...touched() });
    await db.payments.where('id').anyOf((await db.payments.toArray()).filter(p => p.categoryId === id).map(p => p.id)).modify({ categoryId: null, ...touched() });
    await db.categories.update(id, { deleted: 1, ...touched() });
  });
}

export async function setPlanCategory(db: AtlerDB, planId: string, categoryId: string | null) {
  await db.plans.update(planId, { categoryId, ...touched() });
}
