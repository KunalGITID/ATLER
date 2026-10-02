import { useState } from 'react';
import { addDays, endOfMonth, startOfMonth, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import { spentInMonth } from '../core/spent.ts';
import { deletePayment, restorePayment } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { planHref } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { useToast } from '../ui/Toast.tsx';
import { EditExpenseSheet } from './ExpenseSheet.tsx';

const monthKey = (d: Day) => d.slice(0, 7);
const monthLabel = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (d: Day, today: Day) => d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday'
  : new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Spent({ db, month, plans, events, payments, categories }: {
  db: AtlerDB; month: Day; plans: Plan[]; events: PlanEvent[]; payments: Payment[]; categories: Category[];
}) {
  const today = todayDay();
  const toast = useToast();
  const [editing, setEditing] = useState<Payment | null>(null);
  const s = spentInMonth(month, today, plans, events, payments);
  const prev = startOfMonth(addDays(month, -1));
  const next = addDays(endOfMonth(month), 1);
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name;

  return (
    <div className="flex flex-col gap-2.5">
      <Block tone="money" className="!p-4">
        <div className="flex items-center justify-between">
          <a href={`#/spent/${monthKey(prev)}`} aria-label={`Previous month, ${monthLabel(prev)}`} className="flex size-10 items-center justify-center rounded-xl bg-on-color/10 text-on-color no-underline">‹</a>
          <Kicker>Spent in {monthLabel(month)}</Kicker>
          {next <= today
            ? <a href={`#/spent/${monthKey(next)}`} aria-label={`Next month, ${monthLabel(next)}`} className="flex size-10 items-center justify-center rounded-xl bg-on-color/10 text-on-color no-underline">›</a>
            : <span className="size-10" aria-hidden="true" />}
        </div>
        <div className="num mt-2 text-center text-[40px] leading-none font-bold">{formatRupees(s.total)}</div>
        <div className="mt-2 text-center"><a href={`#/year/${month.slice(0, 4)}`} className="text-[13px] font-extrabold text-on-color underline">Year in review ›</a></div>
      </Block>

      {!s.days.length && <Block><p className="text-sm text-ink-2">Nothing was spent in {monthLabel(month)}.</p></Block>}

      {s.days.map(day => (
        <section key={day.on} aria-label={dayLabel(day.on, today)} className="rounded-tile bg-block px-4 pt-3 pb-1">
          <div className="flex justify-between text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
            <span>{dayLabel(day.on, today)}</span><span className="num">{formatRupees(day.total)}</span>
          </div>
          <ul>
            {day.items.map((it, i) => (
              <li key={it.kind === 'expense' ? it.payment.id : it.planId} className={i ? 'border-t-2 border-ground' : ''}>
                {it.kind === 'expense' ? (
                  <button type="button" onClick={() => setEditing(it.payment)} className="flex w-full items-center justify-between py-3 text-left">
                    <span><span className="block text-[15px] font-bold">{it.payment.name}</span>
                      <span className="text-xs text-ink-2">{categoryName(it.payment.categoryId) ?? 'Expense'}</span></span>
                    <span className="num text-lg font-bold">{formatRupees(it.payment.amount)}</span>
                  </button>
                ) : (
                  <a href={planHref(it.planId)} className="flex items-center justify-between py-3 text-ink no-underline">
                    <span><span className="block text-[15px] font-bold">{it.name}</span><span className="text-xs text-ink-2">Renewal</span></span>
                    <span className="num text-lg font-bold">{formatRupees(it.amount)}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <EditExpenseSheet
          key={editing.id}
          db={db}
          payment={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            const { id, name } = editing;
            await deletePayment(db, id);
            setEditing(null);
            toast({ text: `${name} deleted`, action: { label: 'Undo', run: () => void restorePayment(db, id) } });
          }}
        />
      )}
    </div>
  );
}
