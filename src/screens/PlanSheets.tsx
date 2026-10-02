import { useState, type FormEvent } from 'react';
import { datesUntil, parseDay, today as todayDay, type Cycle, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
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
import { keepRate, MoneyInput, moneyValue, resolveMoney } from '../ui/MoneyInput.tsx';
import { More, PlanExtras, planExtras, PlanTypeField } from './ExtraFields.tsx';

export function EditPlanSheet({ db, plan, categories, open, onClose }: { db: AtlerDB; plan: Plan; categories: Category[]; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(plan.name);
  const [money, setMoney] = useState(moneyValue(plan.price, plan.foreign));
  const [extras, setExtras] = useState(planExtras(plan));
  const [cycle, setCycle] = useState(cycleKey(plan.cycle));
  const [error, setError] = useState('');
  const [category, setCategory] = useState(plan.categoryId ?? '');
  const trial = plan.status === 'trial' && plan.trialEnds !== null && plan.trialEnds > todayDay();
  // The date people know: the most recent charge (or the trial's end / a
  // first charge that's still ahead).
  const shownDate: Day = trial ? plan.trialEnds! : plan.anchor > todayDay() ? plan.anchor : datesUntil(plan.anchor, plan.cycle, todayDay()).at(-1) ?? plan.anchor;
  const [date, setDate] = useState<string>(shownDate);
  const [newCategory, setNewCategory] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = resolveMoney(money);
    if (!name.trim()) return setError('It needs a name.');
    if (!m.ok) return setError(m.error);
    const price = m.inr;
    const endsOn = extras.endsOn ? parseDay(extras.endsOn) : null;
    if (extras.endsOn && !endsOn) return setError('Pick a valid last charge date, or leave it empty.');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    const day = parseDay(date);
    if (!day) return setError('Pick a date.');
    if (trial && day <= todayDay()) return setError('A trial has to end after today.');
    keepRate(money);
    await editPlan(db, plan, {
      name, price, cycle: CYCLES[cycle]!.cycle as Cycle, anchor: day !== shownDate ? day : undefined,
      kind: extras.kind, autopay: extras.autopay, endsOn, sharedBy: Math.max(1, Math.floor(Number(extras.sharedBy) || 1)), foreign: m.foreign,
    }, todayDay());
    const categoryId = await resolveCategory(db, category, newCategory);
    if (categoryId !== plan.categoryId) await setPlanCategory(db, plan.id, categoryId);
    onClose();
  }

  const resolved = resolveMoney(money);
  const priceChanged = resolved.ok && resolved.inr !== plan.price;
  return (
    <Sheet open={open} onClose={onClose} title={`Edit ${plan.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">Edit {plan.name}</h2>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <MoneyInput label={u => `Amount (${u})`} value={money} onChange={setMoney} />
        {priceChanged && <p className="-mt-1 text-xs font-bold text-ink-2">Recorded as a price change from today. Past payments keep {formatRupees(plan.price)}.</p>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-cycle" className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Billed</label>
          <select id="edit-cycle" value={cycle} onChange={e => setCycle(e.target.value)} className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
            {Object.entries(CYCLES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
          </select>
        </div>
        <Field label={trial ? 'Trial ends on' : 'Last charged on'} type="date" value={date} onChange={e => setDate(e.target.value)} />
        {date !== shownDate && <p className="-mt-1 text-xs font-bold text-ink-2">Every renewal moves to match, past ones included.</p>}
        <CategoryPicker categories={categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
        <More open={extras.kind !== 'subscription' || !extras.autopay || !!extras.endsOn || extras.sharedBy !== '1'}>
          <PlanTypeField value={extras} onChange={setExtras} />
          <PlanExtras value={extras} onChange={setExtras} price={resolved.ok ? resolved.inr : null} />
        </More>
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
