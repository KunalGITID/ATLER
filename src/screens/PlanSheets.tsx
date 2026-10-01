import { useState, type FormEvent } from 'react';
import { today as todayDay, type Cycle } from '../core/dates.ts';
import { formatRupees, parseRupees } from '../core/money.ts';
import type { Category, Plan } from '../core/model.ts';
import { resolveCategory } from '../data/actions.ts';
import { setPlanCategory } from '../data/categoryActions.ts';
import { CategoryPicker, NEW_CATEGORY } from '../ui/CategoryPicker.tsx';
import type { AtlerDB } from '../data/db.ts';
import { editPlan } from '../data/planActions.ts';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { CYCLES, cycleKey } from './cycles.ts';

export function EditPlanSheet({ db, plan, categories, open, onClose }: { db: AtlerDB; plan: Plan; categories: Category[]; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(plan.name);
  const [amount, setAmount] = useState(String(plan.price / 100));
  const [cycle, setCycle] = useState(cycleKey(plan.cycle));
  const [error, setError] = useState('');
  const [category, setCategory] = useState(plan.categoryId ?? '');
  const [newCategory, setNewCategory] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = parseRupees(amount);
    if (!name.trim()) return setError('It needs a name.');
    if (price === null || price <= 0) return setError('Enter an amount like 199 or 199.50.');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    await editPlan(db, plan, { name, price, cycle: CYCLES[cycle]!.cycle as Cycle }, todayDay());
    const categoryId = await resolveCategory(db, category, newCategory);
    if (categoryId !== plan.categoryId) await setPlanCategory(db, plan.id, categoryId);
    onClose();
  }

  const priceChanged = parseRupees(amount) !== null && parseRupees(amount) !== plan.price;
  return (
    <Sheet open={open} onClose={onClose} title={`Edit ${plan.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">Edit {plan.name}</h2>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <Field label="Amount (₹)" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        {priceChanged && <p className="-mt-1 text-xs font-bold text-ink-2">Recorded as a price change from today. Past payments keep {formatRupees(plan.price)}.</p>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-cycle" className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Billed</label>
          <select id="edit-cycle" value={cycle} onChange={e => setCycle(e.target.value)} className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
            {Object.entries(CYCLES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
          </select>
        </div>
        <CategoryPicker categories={categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
      </form>
    </Sheet>
  );
}

export function ConfirmSheet({ open, title, body, confirm, onConfirm, onClose }: {
  open: boolean; title: string; body: string; confirm: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-[15px] text-ink-2">{body}</p>
        <Button kind="plain" onClick={onClose}>Keep it</Button>
        <Button kind="danger" onClick={onConfirm}>{confirm}</Button>
      </div>
    </Sheet>
  );
}
