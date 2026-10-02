import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseDay, today as todayDay } from '../core/dates.ts';
import { addIncome, addPayment, addPlan, resolveCategory } from '../data/actions.ts';
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
import { parseReceipt } from '../core/import/receipt.ts';
import { formatRupees, parseRupees, sum } from '../core/money.ts';
import { keepRate, MoneyInput, moneyValue, resolveMoney, type MoneyValue } from '../ui/MoneyInput.tsx';
import { ExpenseExtras, expenseExtras, More, PlanExtras, planExtras, PlanTypeField, parseTags, splitFor } from './ExtraFields.tsx';

type Kind = 'plan' | 'expense' | 'income';

export function AddSheet({ db, categories, plans = [], payments = [], open, startAs, onClose, onTrialAdded }: { db: AtlerDB; categories: Category[]; plans?: Plan[]; payments?: Payment[]; startAs?: Kind; open: boolean; onClose: () => void; onTrialAdded?: () => void }) {
  const today = todayDay();
  const [kind, setKind] = useState<Kind>('plan');
  useEffect(() => { if (open && startAs) setKind(startAs); }, [open, startAs]);
  const [name, setName] = useState('');
  const [money, setMoney] = useState<MoneyValue>(moneyValue());
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
  const [plan, setPlan] = useState(planExtras());
  const [extras, setExtras] = useState(expenseExtras());
  const [monthly, setMonthly] = useState(true);
  const [scan, setScan] = useState<string | null>(null);
  const [source, setSource] = useState<Payment['source']>('manual');
  const photo = useRef<HTMLInputElement>(null);

  function reset() {
    setName(''); setMoney(moneyValue()); setCycleKey('monthly'); setDate(todayDay()); setError(''); setCategory(''); setCategoryPicked(false); setNewCategory('');
    setTrial(false); setTrialEnds(''); setSmsOpen(false); setSmsText(''); setSmsMany(null); setPlan(planExtras()); setExtras(expenseExtras()); setMonthly(true); setScan(null); setSource('manual');
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
    setMoney(moneyValue(x!.amount));
    setDate(x!.on);
    setCategory(categoryFor(x!.category) || suggestCategoryId(x!.name, categories, payments, plans) || '');
    setSource('sms');
    setSmsOpen(false);
    setSmsText('');
  }

  async function addAllSms() {
    for (const x of smsMany ?? []) await addPayment(db, { name: x.name, amount: x.amount, on: x.on, categoryId: categoryFor(x.category) || suggestCategoryId(x.name, categories, payments, plans), source: 'sms' });
    reset();
    onClose();
  }

  async function readPhoto(file: File) {
    setError('');
    setScan('Reading the photo… (the first scan downloads the reader, a few MB)');
    try {
      const { readImageText } = await import('../data/ocr.ts');
      const text = await readImageText(file, p => setScan(`Reading the photo… ${Math.round(p * 100)}%`));
      const r = parseReceipt(text);
      if (!r.amount && !r.name) { setScan(null); return setError("Couldn't read a bill there. Try a sharper, straight-on photo."); }
      if (r.name) typeName(r.name);
      if (r.amount) setMoney(moneyValue(r.amount));
      if (r.on && r.on <= todayDay()) setDate(r.on);
      if (r.category && !categoryPicked) setCategory(categoryFor(r.category) || (r.name ? suggestCategoryId(r.name, categories, payments, plans) : null) || '');
      setSource('receipt');
      setScan('Filled in from the photo. Check it before adding.');
    } catch {
      setScan(null);
      setError("Couldn't read the photo. Scanning needs a connection the first time.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = resolveMoney(money);
    const day = parseDay(date);
    if (!name.trim()) return setError(kind === 'plan' ? 'What is it called?' : kind === 'income' ? 'Where is it from?' : 'What was it for?');
    if (!m.ok) return setError(m.error);
    if (!day && !(kind === 'plan' && trial)) return setError('Pick a date.');
    if (kind === 'income') {
      await addIncome(db, { name, amount: m.inr, on: day!, repeat: monthly ? 'monthly' : 'none' });
      reset();
      return onClose();
    }
    const ends = kind === 'plan' && trial ? parseDay(trialEnds) : null;
    if (kind === 'plan' && trial && (!ends || ends <= today)) return setError('Pick the day the trial ends (after today).');
    const endsOn = kind === 'plan' && plan.endsOn ? parseDay(plan.endsOn) : null;
    if (kind === 'plan' && plan.endsOn && !endsOn) return setError('Pick a valid last charge date, or leave it empty.');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    keepRate(money);
    const categoryId = await resolveCategory(db, category, newCategory);
    if (kind === 'plan') {
      await addPlan(db, {
        name, price: m.inr, cycle: CYCLES[cycleKey]!.cycle, lastCharged: ends ?? day!, today, categoryId, trialEnds: ends,
        kind: plan.kind, autopay: plan.autopay, endsOn, sharedBy: Math.max(1, Math.floor(Number(plan.sharedBy) || 1)), foreign: m.foreign,
      });
    } else {
      await addPayment(db, { name, amount: m.inr, on: day!, categoryId, source, note: extras.note, tags: parseTags(extras.tags), split: splitFor(extras, m.inr), foreign: m.foreign });
    }
    if (ends) onTrialAdded?.(); // a trial's reminder needs notifications: ask while the tap is fresh
    reset();
    onClose();
  }

  const preview = resolveMoney(money);
  const title = kind === 'plan' ? 'Add a plan' : kind === 'income' ? 'Add income' : 'Add an expense';
  return (
    <Sheet open={open} onClose={() => { reset(); onClose(); }} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <Segmented
          label="What are you adding?"
          value={kind}
          onChange={k => { setKind(k); setError(''); }}
          options={[{ value: 'plan', label: 'Plan' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" onClick={() => setSmsOpen(true)} className="text-sm font-bold text-money">Paste a bank SMS</button>
            <button type="button" onClick={() => photo.current?.click()} className="text-sm font-bold text-money">Scan a bill or screenshot</button>
            <input ref={photo} type="file" accept="image/*" capture="environment" hidden aria-label="Bill photo"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void readPhoto(f); }} />
          </div>
        ))}
        {kind === 'expense' && scan && <p role="status" className="-mt-1 text-xs font-bold text-ink-2">{scan}</p>}
        <Field label={kind === 'plan' ? 'Name' : kind === 'income' ? 'From' : 'What for'} placeholder={kind === 'plan' ? 'Netflix' : kind === 'income' ? 'Salary' : 'Groceries'}
          value={name} onChange={e => (kind === 'income' ? setName(e.target.value) : typeName(e.target.value))} autoComplete="off" />
        {kind === 'plan' && (
          // Small on purpose: most plans aren't trials. White when on = chosen.
          <button type="button" role="switch" aria-checked={trial} aria-label="Free trial" onClick={() => setTrial(!trial)}
            className={`-mt-1 flex h-8 items-center gap-1.5 self-start rounded-full px-3 text-xs font-extrabold transition-colors ${trial ? 'bg-here text-on-color' : 'bg-block-2 text-ink-2'}`}>
            <span aria-hidden="true">{trial ? '✓' : '+'}</span>Free trial
          </button>
        )}
        <MoneyInput label={u => (kind === 'plan' && trial ? `Price after the trial (${u})` : `Amount (${u})`)} value={money} onChange={setMoney} />
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
            <Field label={kind === 'plan' ? 'Last charged on' : kind === 'income' ? (monthly ? 'First paid on' : 'Received on') : 'Date'} type="date" value={date} onChange={e => setDate(e.target.value)} />
            {kind === 'plan' && <p className="-mt-1 text-xs text-ink-2">Every renewal is counted from this date. Use a future date if it hasn't started yet.</p>}
          </>
        )}
        {kind === 'income' && (
          <button type="button" role="switch" aria-checked={monthly} aria-label="Every month" onClick={() => setMonthly(!monthly)}
            className={`-mt-1 flex h-8 items-center gap-1.5 self-start rounded-full px-3 text-xs font-extrabold transition-colors ${monthly ? 'bg-here text-on-color' : 'bg-block-2 text-ink-2'}`}>
            <span aria-hidden="true">{monthly ? '✓' : '+'}</span>Every month
          </button>
        )}
        {kind !== 'income' && <CategoryPicker categories={categories} value={category} onChange={v => { setCategory(v); setCategoryPicked(true); }} newName={newCategory} onNewName={setNewCategory} />}
        {kind === 'plan' && (
          <More>
            <PlanTypeField value={plan} onChange={setPlan} />
            <PlanExtras value={plan} onChange={setPlan} price={preview.ok ? preview.inr : parseRupees(money.amount)} />
          </More>
        )}
        {kind === 'expense' && (
          <More>
            <ExpenseExtras value={extras} onChange={setExtras} amount={preview.ok ? preview.inr : null} />
          </More>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">{kind === 'plan' ? 'ADD PLAN' : kind === 'income' ? 'ADD INCOME' : 'ADD EXPENSE'}</Button>
      </form>
    </Sheet>
  );
}

