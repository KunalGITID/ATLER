import { useState, type FormEvent } from 'react';
import { parseDay } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Payment } from '../core/model.ts';
import { resolveCategory, updatePayment } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { CategoryPicker, NEW_CATEGORY } from '../ui/CategoryPicker.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { keepRate, MoneyInput, moneyValue, resolveMoney } from '../ui/MoneyInput.tsx';
import { ExpenseExtras, expenseExtras, More, parseTags, splitFor } from './ExtraFields.tsx';

export function EditExpenseSheet({ db, payment, categories, onClose, onDelete }: {
  db: AtlerDB; payment: Payment; categories: Category[]; onClose: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(payment.name);
  const [money, setMoney] = useState(moneyValue(payment.amount, payment.foreign));
  const [extras, setExtras] = useState(expenseExtras(payment));
  const [split, setSplit] = useState(payment.split ?? []);
  const [date, setDate] = useState<string>(payment.on);
  const [category, setCategory] = useState(payment.categoryId ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = resolveMoney(money);
    const on = parseDay(date);
    if (!name.trim()) return setError('What was it for?');
    if (!m.ok) return setError(m.error);
    const value = m.inr;
    if (!on) return setError('Pick a date.');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    keepRate(money);
    const people = splitFor({ ...extras, split }, value, payment.amount);
    await updatePayment(db, payment.id, {
      name, amount: value, on, categoryId: await resolveCategory(db, category, newCategory),
      note: extras.note, tags: parseTags(extras.tags), split: people, foreign: m.foreign,
    });
    onClose();
  }

  const resolved = resolveMoney(money);
  return (
    <Sheet open onClose={onClose} title={`Edit ${payment.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">Edit expense</h2>
        <Field label="What for" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <MoneyInput label={u => `Amount (${u})`} value={money} onChange={setMoney} />
        <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <CategoryPicker categories={categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
        {split.length > 0 && (
          <div className="rounded-2xl bg-block px-3 py-2">
            <div className="text-xs font-bold tracking-[0.06em] text-ink-2 uppercase">Owed to you</div>
            <ul>
              {split.map((s, i) => (
                <li key={s.who} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className={s.settled ? 'text-ink-2 line-through' : 'font-bold'}>{s.who} · {formatRupees(s.amount)}</span>
                  <button type="button" className="text-xs font-bold text-money" onClick={() => setSplit(split.map((x, j) => (j === i ? { ...x, settled: !x.settled } : x)))}>
                    {s.settled ? 'Not settled' : 'Mark settled'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <More open={!!(extras.note || extras.tags || extras.splitWith)}>
          <ExpenseExtras value={extras} onChange={setExtras} amount={resolved.ok ? resolved.inr : null} />
        </More>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
        <Button kind="danger" onClick={onDelete}>Delete expense</Button>
      </form>
    </Sheet>
  );
}
