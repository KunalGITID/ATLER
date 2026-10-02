import { useState, type FormEvent } from 'react';
import { parseDay } from '../core/dates.ts';
import { parseRupees } from '../core/money.ts';
import type { Category, Payment } from '../core/model.ts';
import { resolveCategory, updatePayment } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { CategoryPicker, NEW_CATEGORY } from '../ui/CategoryPicker.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export function EditExpenseSheet({ db, payment, categories, onClose, onDelete }: {
  db: AtlerDB; payment: Payment; categories: Category[]; onClose: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(payment.name);
  const [amount, setAmount] = useState(String(payment.amount / 100));
  const [date, setDate] = useState<string>(payment.on);
  const [category, setCategory] = useState(payment.categoryId ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseRupees(amount);
    const on = parseDay(date);
    if (!name.trim()) return setError('What was it for?');
    if (value === null || value <= 0) return setError('Enter an amount like 199 or 199.50.');
    if (!on) return setError('Pick a date.');
    if (category === NEW_CATEGORY && !newCategory.trim()) return setError('Name the new category.');
    await updatePayment(db, payment.id, { name, amount: value, on, categoryId: await resolveCategory(db, category, newCategory) });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={`Edit ${payment.name}`}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">Edit expense</h2>
        <Field label="What for" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        <Field label="Amount (₹)" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <CategoryPicker categories={categories} value={category} onChange={setCategory} newName={newCategory} onNewName={setNewCategory} />
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
        <Button kind="danger" onClick={onDelete}>Delete expense</Button>
      </form>
    </Sheet>
  );
}
