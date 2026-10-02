import { useState, type FormEvent } from 'react';
import { addDays, endOfMonth, parseDay, startOfMonth, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees, parseRupees, paise, sum } from '../core/money.ts';
import type { Goal, Income, Payment, Plan, PlanEvent } from '../core/model.ts';
import { goalView, incomeBetween, monthMoney } from '../core/money-in.ts';
import { addGoal, addIncome, deleteGoal, deleteIncome, restoreIncome, updateGoal, updateIncome } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useToast } from '../ui/Toast.tsx';

const fmtDay = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function IncomeSheet({ db, income, onClose }: { db: AtlerDB; income: Income | 'new'; onClose: () => void }) {
  const old = income === 'new' ? null : income;
  const [name, setName] = useState(old?.name ?? '');
  const [amount, setAmount] = useState(old ? String(old.amount / 100) : '');
  const [date, setDate] = useState<string>(old?.on ?? todayDay());
  const [monthly, setMonthly] = useState(old ? old.repeat === 'monthly' : true);
  const [error, setError] = useState('');
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseRupees(amount);
    const on = parseDay(date);
    if (!name.trim()) return setError('Where is it from?');
    if (value === null || value <= 0) return setError('Enter an amount like 50000.');
    if (!on) return setError('Pick a date.');
    const row = { name, amount: value, on, repeat: monthly ? 'monthly' as const : 'none' as const };
    if (old) await updateIncome(db, old.id, row); else await addIncome(db, row);
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={old ? `Edit ${old.name}` : 'Add income'}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">{old ? 'Edit income' : 'Add income'}</h2>
        <Field label="From" placeholder="Salary" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <Field label="Amount (₹)" inputMode="decimal" placeholder="50000" value={amount} onChange={e => setAmount(e.target.value)} />
        <Field label={monthly ? 'First paid on' : 'Received on'} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button type="button" role="switch" aria-checked={monthly} aria-label="Every month" onClick={() => setMonthly(!monthly)}
          className={`-mt-1 flex h-8 items-center gap-1.5 self-start rounded-full px-3 text-xs font-extrabold ${monthly ? 'bg-here text-on-color' : 'bg-block-2 text-ink-2'}`}>
          <span aria-hidden="true">{monthly ? '✓' : '+'}</span>Every month
        </button>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
        {old && <Button kind="danger" onClick={async () => {
          await deleteIncome(db, old.id);
          onClose();
          toast({ text: `${old.name} deleted`, action: { label: 'Undo', run: () => void restoreIncome(db, old.id) } });
        }}>Delete income</Button>}
      </form>
    </Sheet>
  );
}

function GoalSheet({ db, goal, onClose }: { db: AtlerDB; goal: Goal | 'new'; onClose: () => void }) {
  const old = goal === 'new' ? null : goal;
  const [name, setName] = useState(old?.name ?? '');
  const [target, setTarget] = useState(old ? String(old.target / 100) : '');
  const [saved, setSaved] = useState(old ? String(old.saved / 100) : '');
  const [by, setBy] = useState<string>(old?.by ?? '');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = parseRupees(target);
    const s = saved.trim() ? parseRupees(saved) : paise(0);
    const day = by ? parseDay(by) : null;
    if (!name.trim()) return setError('What are you saving for?');
    if (t === null || t <= 0) return setError('Enter the amount you need, like 80000.');
    if (s === null) return setError('Enter what you have saved so far, or leave it empty.');
    if (by && (!day || day <= todayDay())) return setError('Pick a date after today, or leave it empty.');
    const row = { name, target: t, saved: s, by: day };
    if (old) await updateGoal(db, old.id, row); else await addGoal(db, row);
    onClose();
  }
  return (
    <Sheet open onClose={onClose} title={old ? `Edit ${old.name}` : 'New goal'}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">{old ? 'Edit goal' : 'New goal'}</h2>
        <Field label="Saving for" placeholder="New laptop" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <Field label="Amount needed (₹)" inputMode="decimal" placeholder="80000" value={target} onChange={e => setTarget(e.target.value)} />
        <Field label="Saved so far (₹)" inputMode="decimal" placeholder="0" value={saved} onChange={e => setSaved(e.target.value)} />
        <Field label="By (optional)" type="date" value={by} onChange={e => setBy(e.target.value)} />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
        {old && <Button kind="danger" onClick={async () => { await deleteGoal(db, old.id); onClose(); }}>Delete goal</Button>}
      </form>
    </Sheet>
  );
}

function AddToGoal({ db, goal, onClose }: { db: AtlerDB; goal: Goal; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  return (
    <Sheet open onClose={onClose} title={`Add to ${goal.name}`}>
      <form className="flex flex-col gap-3" noValidate onSubmit={async e => {
        e.preventDefault();
        const v = parseRupees(amount);
        if (v === null || v <= 0) return setError('Enter an amount like 5000.');
        await updateGoal(db, goal.id, { saved: sum([goal.saved, v]) });
        onClose();
      }}>
        <h2 className="font-display text-2xl font-bold">Add to {goal.name}</h2>
        <Field label="Amount (₹)" inputMode="decimal" placeholder="5000" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">ADD</Button>
      </form>
    </Sheet>
  );
}

export function MoneyPanel({ db, incomes, goals, plans, events, payments }: {
  db: AtlerDB; incomes: Income[]; goals: Goal[]; plans: Plan[]; events: PlanEvent[]; payments: Payment[];
}) {
  const today = todayDay();
  const [editing, setEditing] = useState<Income | 'new' | null>(null);
  const [goalEditing, setGoalEditing] = useState<Goal | 'new' | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const m = monthMoney(today, incomes, plans, events, payments);
  const thisMonth = incomeBetween(incomes, startOfMonth(today), endOfMonth(today));
  const lastMonth = incomeBetween(incomes, startOfMonth(addDays(startOfMonth(today), -1)), addDays(startOfMonth(today), -1));
  const views = goals.map(g => goalView(g, today)).sort((a, b) => Number(a.reached) - Number(b.reached) || (a.goal.by ?? '9').localeCompare(b.goal.by ?? '9'));
  const needed = sum(views.filter(v => v.perMonth).map(v => v.perMonth!));

  return (
    <div className="flex flex-col gap-2.5">
      <Block tone="money" className="!p-4">
        <Kicker>Left this month</Kicker>
        <div className="num mt-1 text-[40px] leading-none font-bold">{formatRupees(m.left)}</div>
        <div className="mt-2 text-[13px] font-bold">
          {m.income > 0
            ? `${formatRupees(m.income)} in − ${formatRupees(m.spent)} spent − ${formatRupees(m.toCome)} still coming${m.savingsRate !== null ? ` · ${Math.round(m.savingsRate * 100)}% saved` : ''}`
            : 'Add your income to see what’s left each month and how much you save.'}
        </div>
      </Block>

      <section aria-labelledby="incomes" className="rounded-tile bg-block px-4 pt-3 pb-2">
        <h2 id="incomes" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Income</h2>
        {incomes.length > 0 && (
          <ul>
            {[...incomes].sort((a, b) => b.amount - a.amount).map((inc, i) => (
              <li key={inc.id} className={i ? 'border-t-2 border-ground' : ''}>
                <button type="button" onClick={() => setEditing(inc)} className="flex w-full items-center justify-between py-3 text-left">
                  <span><span className="block text-[15px] font-bold">{inc.name}</span>
                    <span className="text-xs text-ink-2">{inc.repeat === 'monthly' ? `Every month from ${fmtDay(inc.on)}` : `Once, ${fmtDay(inc.on)}`}</span></span>
                  <span className="num text-lg font-bold">{formatRupees(inc.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {incomes.length > 0 && (
          <p className="pb-2 text-xs text-ink-2">This month {formatRupees(sum(thisMonth.map(i => i.amount)))} ({formatRupees(m.received)} arrived) · last month {formatRupees(sum(lastMonth.map(i => i.amount)))}</p>
        )}
        <Button kind="quiet" className="mb-1 w-full" onClick={() => setEditing('new')}>Add income</Button>
      </section>

      <section aria-labelledby="goals" className="rounded-tile bg-block px-4 pt-3 pb-2">
        <h2 id="goals" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Goals</h2>
        {views.length > 0 && needed > 0 && (
          <p className={`pt-1 text-xs font-bold ${m.income > 0 && needed > Math.max(0, m.left) ? 'text-soon' : 'text-ink-2'}`}>
            {formatRupees(needed)} a month keeps every goal on time{m.income > 0 ? `; ${formatRupees(paise(Math.max(0, m.left)))} is left this month` : ''}.
          </p>
        )}
        <ul>
          {views.map((v, i) => (
            <li key={v.goal.id} className={`py-3 ${i ? 'border-t-2 border-ground' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <button type="button" onClick={() => setGoalEditing(v.goal)} className="min-w-0 text-left">
                  <span className="block truncate text-[15px] font-bold">{v.goal.name}</span>
                  <span className="text-xs text-ink-2">
                    {v.reached ? 'Reached' : `${formatRupees(v.left)} to go`}{v.goal.by ? ` · by ${fmtDay(v.goal.by)}` : ''}{v.perMonth ? ` · ${formatRupees(v.perMonth)}/mo` : ''}
                  </span>
                </button>
                {!v.reached && <button type="button" onClick={() => setAdding(v.goal)} className="h-9 shrink-0 rounded-control bg-block-2 px-3 text-xs font-extrabold">Add</button>}
              </div>
              <div className="mt-2 h-2 rounded-full bg-block-2" role="img" aria-label={`${v.goal.name}: ${Math.round(v.done * 100)}% saved, ${formatRupees(v.goal.saved)} of ${formatRupees(v.goal.target)}`}>
                <div className="h-full rounded-full bg-money" style={{ width: `${Math.max(2, v.done * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <Button kind="quiet" className="mb-1 w-full" onClick={() => setGoalEditing('new')}>Add a goal</Button>
      </section>

      {editing && <IncomeSheet key={editing === 'new' ? 'new' : editing.id} db={db} income={editing} onClose={() => setEditing(null)} />}
      {goalEditing && <GoalSheet key={goalEditing === 'new' ? 'new' : goalEditing.id} db={db} goal={goalEditing} onClose={() => setGoalEditing(null)} />}
      {adding && <AddToGoal db={db} goal={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}
