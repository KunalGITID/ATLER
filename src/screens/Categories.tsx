import { useState, type FormEvent } from 'react';
import { formatRupees, parseRupees } from '../core/money.ts';
import type { Category } from '../core/model.ts';
import { addCategory, deleteCategory, updateCategory } from '../data/categoryActions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';

function CategorySheet({ db, category, onClose }: { db: AtlerDB; category: Category | 'new'; onClose: () => void }) {
  const existing = category === 'new' ? null : category;
  const [name, setName] = useState(existing?.name ?? '');
  const [budget, setBudget] = useState(existing?.budget ? String(existing.budget / 100) : '');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('It needs a name.');
    const amount = budget.trim() ? parseRupees(budget) : null;
    if (budget.trim() && (amount === null || amount <= 0)) return setError('Enter a monthly budget like 3000, or leave it empty.');
    if (existing) await updateCategory(db, existing.id, { name, budget: amount });
    else await addCategory(db, name, amount);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={existing ? `Edit ${existing.name}` : 'New category'}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <h2 className="font-display text-2xl font-bold">{existing ? `Edit ${existing.name}` : 'New category'}</h2>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Entertainment" autoComplete="off" />
        <Field label="Monthly budget (₹, optional)" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} placeholder="3000" />
        <p className="-mt-1 text-xs text-ink-2">With a budget, the month shows what's spent, what's still coming, and what's left.</p>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit">SAVE</Button>
        {existing && <Button kind="danger" onClick={async () => { await deleteCategory(db, existing.id); onClose(); }}>Delete category</Button>}
      </form>
    </Sheet>
  );
}

export function Categories({ db, categories }: { db: AtlerDB; categories: Category[] }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Block className="!p-4">
      <Kicker className="text-ink-2">Categories & budgets</Kicker>
      {sorted.length > 0 && (
        <ul className="mt-1">
          {sorted.map((c, i) => (
            <li key={c.id} className={i ? 'border-t-2 border-ground' : ''}>
              <button type="button" onClick={() => setEditing(c)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="text-[15px] font-bold">{c.name}</span>
                <span className={`num text-sm ${c.budget ? 'font-bold' : 'text-ink-2'}`}>{c.budget ? `${formatRupees(c.budget)}/mo` : 'No budget'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button kind="quiet" className="mt-2 w-full" onClick={() => setEditing('new')}>Add a category</Button>
      {editing && <CategorySheet key={editing === 'new' ? 'new' : editing.id} db={db} category={editing} onClose={() => setEditing(null)} />}
    </Block>
  );
}
