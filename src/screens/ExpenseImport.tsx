import { useRef, useState } from 'react';
import { readExpenses, sameExpense, type ExpenseImport as Read } from '../core/import/expenses.ts';
import { formatRupees, sum } from '../core/money.ts';
import type { Category, Payment } from '../core/model.ts';
import { suggestCategoryId } from '../core/suggest.ts';
import { addCategory } from '../data/categoryActions.ts';
import { addPayment } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const FORMAT = { walnut: 'Walnut export', splitwise: 'Splitwise export', statement: 'Bank statement' } as const;

// Expenses from Walnut, Splitwise or a bank CSV, read on the phone. Anything
// already in ATLER (same day, amount and name) is left out.
export function ExpenseImport({ db, payments, categories }: { db: AtlerDB; payments: Payment[]; categories: Category[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [read, setRead] = useState<(Read & { fresh: Read['expenses']; dupes: number }) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [makeCategories, setMakeCategories] = useState(true);
  const [busy, setBusy] = useState(false);

  async function open(file: File) {
    setMessage(null);
    try {
      const r = readExpenses(await file.text());
      const fresh = r.expenses.filter(e => !payments.some(p => sameExpense(p, e)));
      if (!r.expenses.length) return setMessage('No expenses found in that file.');
      setRead({ ...r, fresh, dupes: r.expenses.length - fresh.length });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function save() {
    if (!read) return;
    setBusy(true);
    const byName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    for (const e of read.fresh) {
      let categoryId = e.category ? byName.get(e.category.toLowerCase()) ?? null : null;
      if (!categoryId && e.category && makeCategories) {
        categoryId = (await addCategory(db, e.category)).id;
        byName.set(e.category.toLowerCase(), categoryId);
      }
      categoryId ??= suggestCategoryId(e.name, categories, payments, []);
      await addPayment(db, { name: e.name, amount: e.amount, on: e.on, categoryId, source: 'import', note: e.note, tags: e.tags });
    }
    setBusy(false);
    setMessage(`${read.fresh.length} expense${read.fresh.length === 1 ? '' : 's'} added.`);
    setRead(null);
  }

  const newCategories = read ? [...new Set(read.fresh.map(e => e.category).filter((c): c is string => !!c && !categories.some(k => k.name.toLowerCase() === c.toLowerCase())))] : [];
  return (
    <Block className="flex flex-col gap-2.5 !p-4">
      <Kicker className="text-ink-2">Import expenses</Kicker>
      <p className="text-sm text-ink-2">From a Walnut or Splitwise export, or any bank CSV. Read on this phone; anything already here is skipped.</p>
      <Button kind="quiet" onClick={() => input.current?.click()}>Choose a CSV</Button>
      <input ref={input} type="file" accept=".csv,text/csv" hidden aria-label="Expenses file"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(f); }} />
      {message && <p role="status" className="text-sm font-bold">{message}</p>}

      <Sheet open={read !== null} onClose={() => setRead(null)} title="Import expenses">
        <div className="flex max-h-[80vh] flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">{read ? FORMAT[read.format] : ''}</h2>
          <p className="text-sm text-ink-2">
            {read?.fresh.length ?? 0} new expense{read?.fresh.length === 1 ? '' : 's'}, {formatRupees(sum(read?.fresh.map(e => e.amount) ?? []))}
            {read?.dupes ? ` · ${read.dupes} already in ATLER` : ''}{read?.skipped ? ` · ${read.skipped} rows skipped (income, transfers, settle-ups)` : ''}.
            {read?.format === 'splitwise' ? ' Splitwise amounts are the whole bill; edit one to split it.' : ''}
          </p>
          <ul className="flex flex-col overflow-y-auto rounded-tile bg-block text-sm">
            {read?.fresh.slice(0, 50).map((e, i) => (
              <li key={i} className={`flex justify-between gap-3 px-4 py-2 ${i ? 'border-t-2 border-ground' : ''}`}>
                <span className="min-w-0 truncate">{e.on} · {e.name}{e.category ? ` · ${e.category}` : ''}</span>
                <span className="num shrink-0 font-bold">{formatRupees(e.amount)}</span>
              </li>
            ))}
          </ul>
          {newCategories.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-money)]" checked={makeCategories} onChange={e => setMakeCategories(e.target.checked)} />
              <span>Add their categories too: {newCategories.slice(0, 6).join(', ')}{newCategories.length > 6 ? '…' : ''}</span>
            </label>
          )}
          <Button kind="primary" disabled={!read?.fresh.length || busy} onClick={save}>{busy ? 'ADDING…' : read?.fresh.length ? `ADD ${read.fresh.length}` : 'NOTHING NEW'}</Button>
        </div>
      </Sheet>
    </Block>
  );
}
