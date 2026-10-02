import { useState, type FormEvent } from 'react';
import { parseDay, today as todayDay } from '../core/dates.ts';
import { parseRupees } from '../core/money.ts';
import { addPayment, addPlan, resolveCategory } from '../data/actions.ts';
import type { Category, Payment, Plan } from '../core/model.ts';
import { suggestCategoryId } from '../core/suggest.ts';
import { CategoryPicker, NEW_CATEGORY } from '../ui/CategoryPicker.tsx';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Segmented } from '../ui/Segmented.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { CYCLES } from './cycles.ts';
import { parseBankSmsList, type SmsExpense } from '../core/import/sms.ts';
import { formatRupees, sum } from '../core/money.ts';

type Kind = 'plan' | 'expense';


export function AddSheet({ db, categories, plans = [], payments = [], open, onClose, onTrialAdded }: { db: AtlerDB; categories: Category[]; plans?: Plan[]; payments?: Payment[]; open: boolean; onClose: () => void; onTrialAdded?: () => void }) {
  const today = todayDay();
  const [kind, setKind] = useState<Kind>('plan');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [cycleKey, setCycleKey] = useState('monthly');
  const [date, setDate] = useState<string>(today);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [trial, setTrial] = useState(false);
  const [trialEnds, setTrialEnds] = useState('');
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsMany, setSmsMany] = useState<SmsExpense[] | null>(null);

  function reset() {
    setName(''); setAmount(''); setCycleKey('monthly'); setDate(todayDay()); setError(''); setCategory(''); setCategoryPicked(false); setNewCategory(''); setTrial(false); setTrialEnds(''); setSmsOpen(false); setSmsText(''); setSmsMany(null);
  }

  const categoryFor = (name: string | null) => (name && categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id) || '';

  // Fill the category from what you've done before, until you pick one yourself.
  function typeName(value: string) {
    setName(value);
    if (!categoryPicked) setCategory(suggestCategoryId(value, categories, payments, plans) ?? '');
  }

  function readSms() {
    const found = parseBankSmsList(smsText, todayDay());
    setError('');
    if (!found.length) return setError("That doesn't look like a debit SMS.");
    if (found.length > 1) return setSmsMany(found);
    const [x] = found;
    setName(x!.name);
    setAmount(String(x!.amount / 100));
    setDate(x!.on);
    setCategory(categoryFor(x!.category));
    setSmsOpen(false);
    setSmsText('');
  }

  async function addAllSms() {
    for (const x of smsMany ?? []) await addPayment(db, { name: x.name, amount: x.amount, on: x.on, categoryId: categoryFor(x.category) || null });
    reset();
    onClose();
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
        {kind === 'expense' && (smsOpen ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-block p-3">
            <label htmlFor="sms" className="text-xs font-bold tracking-[0.06em] text-ink-2 uppercase">Bank SMS</label>
            <textarea id="sms" rows={3} value={smsText} onChange={e => { setSmsText(e.target.value); setSmsMany(null); }}
              placeholder="Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici…"
              className="rounded-xl border-2 border-block-2 bg-ground p-3 text-base text-ink outline-none focus:border-money" />
            {smsMany ? (
              <>
                <ul className="text-sm">{smsMany.map((x, i) => <li key={i} className="flex justify-between py-1"><span>{x.name}</span><span className="num font-bold">{formatRupees(x.amount)}</span></li>)}</ul>
                <Button kind="primary" onClick={addAllSms}>ADD {smsMany.length} · {formatRupees(sum(smsMany.map(x => x.amount)))}</Button>
              </>
            ) : <Button kind="quiet" onClick={readSms}>Read SMS</Button>}
            <p className="text-xs text-ink-2">Read on this phone only. Paste several messages, one per line, to add them together.</p>
          </div>
        ) : (
          <button type="button" onClick={() => setSmsOpen(true)} className="self-start text-sm font-bold text-money">Paste a bank SMS instead</button>
        ))}
        <Field label={kind === 'plan' ? 'Name' : 'What for'} placeholder={kind === 'plan' ? 'Netflix' : 'Groceries'} value={name} onChange={e => typeName(e.target.value)} autoComplete="off" />
        {kind === 'plan' && (
          // Small on purpose: most plans aren't trials. White when on = chosen.
          <button type="button" role="switch" aria-checked={trial} aria-label="Free trial" onClick={() => setTrial(!trial)}
            className={`-mt-1 flex h-8 items-center gap-1.5 self-start rounded-full px-3 text-xs font-extrabold transition-colors ${trial ? 'bg-here text-on-color' : 'bg-block-2 text-ink-2'}`}>
            <span aria-hidden="true">{trial ? '✓' : '+'}</span>Free trial
          </button>
        )}
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
            <p className="-mt-1 text-xs text-ink-2">Nothing is charged until then. You'll get a reminder 3 days and 1 day before.</p>
          </>
        ) : (
          <>
            <Field label={kind === 'plan' ? 'Last charged on' : 'Date'} type="date" value={date} onChange={e => setDate(e.target.value)} />
            {kind === 'plan' && <p className="-mt-1 text-xs text-ink-2">Every renewal is counted from this date. Use a future date if it hasn't started yet.</p>}
          </>
        )}
        <CategoryPicker categories={categories} value={category} onChange={v => { setCategory(v); setCategoryPicked(true); }} newName={newCategory} onNewName={setNewCategory} />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">{kind === 'plan' ? 'ADD PLAN' : 'ADD EXPENSE'}</Button>
      </form>
    </Sheet>
  );
}
