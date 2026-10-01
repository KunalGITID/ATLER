import { useState, type FormEvent } from 'react';
import { parseDay, today as todayDay, type Cycle } from '../core/dates.ts';
import { parseRupees } from '../core/money.ts';
import { addPayment, addPlan } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { Sheet } from '../ui/Sheet.tsx';

type Kind = 'plan' | 'expense';

const CYCLES: Record<string, { label: string; cycle: Cycle }> = {
  monthly: { label: 'Monthly', cycle: { unit: 'month', every: 1 } },
  yearly: { label: 'Yearly', cycle: { unit: 'year', every: 1 } },
  quarterly: { label: 'Every 3 months', cycle: { unit: 'month', every: 3 } },
  d28: { label: 'Every 28 days (prepaid mobile)', cycle: { unit: 'day', every: 28 } },
  weekly: { label: 'Weekly', cycle: { unit: 'day', every: 7 } },
};

export function AddSheet({ db, open, onClose }: { db: AtlerDB; open: boolean; onClose: () => void }) {
  const today = todayDay();
  const [kind, setKind] = useState<Kind>('plan');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycleKey, setCycleKey] = useState('monthly');
  const [date, setDate] = useState<string>(today);
  const [error, setError] = useState('');

  function reset() {
    setName(''); setAmount(''); setCycleKey('monthly'); setDate(todayDay()); setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = parseRupees(amount);
    const day = parseDay(date);
    if (!name.trim()) return setError(kind === 'plan' ? 'What is it called?' : 'What was it for?');
    if (price === null || price <= 0) return setError('Enter an amount like 199 or 199.50.');
    if (!day) return setError('Pick a date.');
    if (kind === 'plan') await addPlan(db, { name, price, cycle: CYCLES[cycleKey]!.cycle, lastCharged: day, today });
    else await addPayment(db, { name, amount: price, on: day });
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
        <Field label="Amount (₹)" inputMode="decimal" placeholder="199" value={amount} onChange={e => setAmount(e.target.value)} />
        {kind === 'plan' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cycle" className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Billed</label>
            <select id="cycle" value={cycleKey} onChange={e => setCycleKey(e.target.value)} className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
              {Object.entries(CYCLES).map(([key, c]) => <option key={key} value={key}>{c.label}</option>)}
            </select>
          </div>
        )}
        <Field label={kind === 'plan' ? 'Last charged on' : 'Date'} type="date" value={date} onChange={e => setDate(e.target.value)} />
        {kind === 'plan' && <p className="-mt-1 text-xs text-ink-2">Every renewal is counted from this date. Use a future date if it hasn't started yet.</p>}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">{kind === 'plan' ? 'ADD PLAN' : 'ADD EXPENSE'}</Button>
      </form>
    </Sheet>
  );
}
