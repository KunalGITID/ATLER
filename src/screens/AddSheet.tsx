import { useState, type FormEvent } from 'react';
import { parseDay, today as todayDay } from '../core/dates.ts';
import { parseRupees } from '../core/money.ts';
import { addPayment, addPlan, resolveCategory } from '../data/actions.ts';
import type { Category } from '../core/model.ts';
import { CategoryPicker, NEW_CATEGORY } from '../ui/CategoryPicker.tsx';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Switch } from '../ui/Switch.tsx';
import { CYCLES } from './cycles.ts';

type Kind = 'plan' | 'expense';


export function AddSheet({ db, categories, open, onClose, onTrialAdded }: { db: AtlerDB; categories: Category[]; open: boolean; onClose: () => void; onTrialAdded?: () => void }) {
  const today = todayDay();
  const [kind, setKind] = useState<Kind>('plan');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycleKey, setCycleKey] = useState('monthly');
  const [date, setDate] = useState<string>(today);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [trial, setTrial] = useState(false);
  const [trialEnds, setTrialEnds] = useState('');

  function reset() {
    setName(''); setAmount(''); setCycleKey('monthly'); setDate(todayDay()); setError(''); setCategory(''); setNewCategory(''); setTrial(false); setTrialEnds('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = parseRupees(amount);
    const day = parseDay(date);
    if (!name.trim()) return setError(kind === 'plan' ? 'What is it called?' : 'What was it for?');
    if (price === null || price <= 0) return setError('Enter an amount like 199 or 199.50.');
    if (!day && !(kind === 'plan' && trial)) return setError('Pick a date.');
    const ends = kind === 'plan' && trial ? parseDay(trialEnds) : null;
    if (kind === 'plan' && trial && (!ends || ends <= today)) return setError('Pick the day the trial ends (after today).');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    const categoryId = await resolveCategory(db, category, newCategory);
    if (kind === 'plan') await addPlan(db, { name, price, cycle: CYCLES[cycleKey]!.cycle, lastCharged: ends ?? day!, today, categoryId, trialEnds: ends });
    else await addPayment(db, { name, amount: price, on: day!, categoryId });
    if (ends) onTrialAdded?.(); // a trial's reminder needs notifications: ask while the tap is fresh
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={() => { reset(); onClose(); }} title={kind === 'plan' ? 'Add a plan' : 'Add an expense'}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Segmented
          label="What are you adding?"
          value={kind}
          onChange={k => { setKind(k); setError(''); }}
          options={[{ value: 'plan', label: 'Plan' }, { value: 'expense', label: 'Expense' }]}
        />
        <Field label={kind === 'plan' ? 'Name' : 'What for'} placeholder={kind === 'plan' ? 'Netflix' : 'Groceries'} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        {kind === 'plan' && <Switch label="Free trial" hint="Nothing is charged until it ends" checked={trial} onChange={setTrial} />}
        <Field label={kind === 'plan' && trial ? 'Price after the trial (₹)' : 'Amount (₹)'} inputMode="decimal" placeholder="199" value={amount} onChange={e => setAmount(e.target.value)} />
        {kind === 'plan' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cycle" className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Billed</label>
            <select id="cycle" value={cycleKey} onChange={e => setCycleKey(e.target.value)} className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
              {Object.entries(CYCLES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
            </select>
          </div>
        )}
        {kind === 'plan' && trial ? (
          <>
            <Field label="Trial ends on" type="date" value={trialEnds} onChange={e => setTrialEnds(e.target.value)} />
            <p className="-mt-1 text-xs text-ink-2">You'll get a reminder 3 days and 1 day before it turns into a charge.</p>
          </>
        ) : (
          <>
            <Field label={kind === 'plan' ? 'Last charged on' : 'Date'} type="date" value={date} onChange={e => setDate(e.target.value)} />
            {kind === 'plan' && <p className="-mt-1 text-xs text-ink-2">Every renewal is counted from this date. Use a future date if it hasn't started yet.</p>}
          </>
        )}
        <CategoryPicker categories={categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">{kind === 'plan' ? 'ADD PLAN' : 'ADD EXPENSE'}</Button>
      </form>
    </Sheet>
  );
}
