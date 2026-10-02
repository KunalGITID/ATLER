import { useState } from 'react';
import { addDays, endOfMonth, startOfMonth, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees, sum } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import { spentInMonth, type SpentDay } from '../core/spent.ts';
import { owedByPerson } from '../core/money-in.ts';
import { othersPart, ownAmount } from '../core/share.ts';
import { formatForeign } from '../core/fx.ts';
import { deletePayment, restorePayment, settleUp } from '../data/actions.ts';
import type { AtlerDB } from '../data/db.ts';
import { planHref } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { useSlide } from '../ui/useSlide.ts';
import { useSwipe } from '../ui/useSwipe.ts';
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
  const slide = useSlide(month);
  const s = spentInMonth(month, today, plans, events, payments);
  const prev = startOfMonth(addDays(month, -1));
  const next = addDays(endOfMonth(month), 1);
  const swipe = useSwipe({
    left: () => { if (next <= today) location.hash = `#/spent/${monthKey(next)}`; },
    right: () => { location.hash = `#/spent/${monthKey(prev)}`; },
  });
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name;
  const [query, setQuery] = useState('');
  const [onlyCategory, setOnlyCategory] = useState('');
  const [onlyTag, setOnlyTag] = useState('');
  const owes = owedByPerson(payments);
  const monthTags = [...new Set(s.days.flatMap(d => d.items.flatMap(it => (it.kind === 'expense' ? it.payment.tags ?? [] : []))))].sort();
  const planCategory = new Map(plans.map(p => [p.id, p.categoryId]));
  const q = query.trim().toLowerCase();
  const filtering = !!(q || onlyCategory || onlyTag);
  const keep = (it: SpentDay['items'][number]) => {
    const cat = it.kind === 'expense' ? it.payment.categoryId : planCategory.get(it.planId) ?? null;
    if (onlyCategory && (onlyCategory === 'none' ? cat !== null : cat !== onlyCategory)) return false;
    if (onlyTag && (it.kind !== 'expense' || !(it.payment.tags ?? []).includes(onlyTag))) return false;
    if (!q) return true;
    const text = it.kind === 'expense'
      ? [it.payment.name, it.payment.note ?? '', ...(it.payment.tags ?? []), categoryName(it.payment.categoryId) ?? ''].join(' ')
      : [it.name, categoryName(cat) ?? ''].join(' ');
    return text.toLowerCase().includes(q);
  };
  const amountOf = (it: SpentDay['items'][number]) => (it.kind === 'expense' ? ownAmount(it.payment) : it.amount);
  const days = filtering
    ? s.days.map(d => { const items = d.items.filter(keep); return { ...d, items, total: sum(items.map(amountOf)) }; }).filter(d => d.items.length)
    : s.days;
  const shownTotal = filtering ? sum(days.map(d => d.total)) : s.total;

  return (
    <div ref={swipe} className="flex flex-col gap-2.5">
      <Block tone="money" className="!p-4">
        <div className="flex items-center justify-between">
          <a href={`#/spent/${monthKey(prev)}`} aria-label={`Previous month, ${monthLabel(prev)}`} className="flex size-10 items-center justify-center rounded-xl bg-on-color/10 text-on-color no-underline">‹</a>
          <Kicker>Spent in {monthLabel(month)}</Kicker>
          {next <= today
            ? <a href={`#/spent/${monthKey(next)}`} aria-label={`Next month, ${monthLabel(next)}`} className="flex size-10 items-center justify-center rounded-xl bg-on-color/10 text-on-color no-underline">›</a>
            : <span className="size-10" aria-hidden="true" />}
        </div>
        <div key={month} className={`num mt-2 text-center text-[40px] leading-none font-bold ${slide}`}>{formatRupees(s.total)}</div>
        <div className="mt-2 text-center"><a href={`#/year/${month.slice(0, 4)}`} className="text-[13px] font-extrabold text-on-color underline">Year in review ›</a></div>
      </Block>

      {(s.days.length > 0 || filtering) && (
        <div className="flex flex-col gap-2 rounded-tile bg-block p-3">
          <label htmlFor="spent-search" className="sr-only">Search this month</label>
          <input id="spent-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names, notes, tags"
            className="h-11 rounded-xl border-2 border-block-2 bg-ground px-3 text-sm font-semibold text-ink outline-none focus:border-money" />
          <div className="flex gap-2">
            <select aria-label="Only category" value={onlyCategory} onChange={e => setOnlyCategory(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border-2 border-block-2 bg-ground px-2 text-sm font-bold text-ink">
              <option value="">All categories</option>
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="none">No category</option>
            </select>
            {monthTags.length > 0 && (
              <select aria-label="Only tag" value={onlyTag} onChange={e => setOnlyTag(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border-2 border-block-2 bg-ground px-2 text-sm font-bold text-ink">
                <option value="">All tags</option>
                {monthTags.map(t => <option key={t} value={t}>#{t}</option>)}
              </select>
            )}
          </div>
          {filtering && <p role="status" className="text-xs font-bold text-ink-2">{formatRupees(shownTotal)} matches · <button type="button" className="text-money" onClick={() => { setQuery(''); setOnlyCategory(''); setOnlyTag(''); }}>Clear</button></p>}
        </div>
      )}

      <div key={month} className={`flex flex-col gap-2.5 ${slide}`}>
      {!s.days.length && <Block><p className="text-sm text-ink-2">Nothing was spent in {monthLabel(month)}.</p></Block>}
      {s.days.length > 0 && !days.length && <Block><p className="text-sm text-ink-2">Nothing matches.</p></Block>}

      {days.map(day => (
        <section key={day.on} aria-label={dayLabel(day.on, today)} className="rounded-tile bg-block px-4 pt-3 pb-1">
          <div className="flex justify-between text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
            <span>{dayLabel(day.on, today)}</span><span className="num">{formatRupees(day.total)}</span>
          </div>
          <ul>
            {day.items.map((it, i) => (
              <li key={it.kind === 'expense' ? it.payment.id : it.planId} className={i ? 'border-t-2 border-ground' : ''}>
                {it.kind === 'expense' ? (
                  <button type="button" onClick={() => setEditing(it.payment)} className="flex w-full items-center justify-between py-3 text-left">
                    <span className="min-w-0"><span className="block truncate text-[15px] font-bold">{it.payment.name}</span>
                      <span className="block text-xs text-ink-2">
                        {categoryName(it.payment.categoryId) ?? 'Expense'}
                        {(it.payment.tags ?? []).map(t => ` · #${t}`).join('')}
                        {it.payment.foreign ? ` · ${formatForeign(it.payment.foreign)}` : ''}
                        {othersPart(it.payment) > 0 ? ` · paid ${formatRupees(it.payment.amount)}, split` : ''}
                      </span>
                      {it.payment.note && <span className="block truncate text-xs text-ink-2 italic">{it.payment.note}</span>}</span>
                    <span className="num shrink-0 text-lg font-bold">{formatRupees(ownAmount(it.payment))}</span>
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

      </div>

      {owes.length > 0 && (
        <section aria-labelledby="owed" className="rounded-tile bg-block px-4 pt-3 pb-1">
          <h2 id="owed" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Owed to you</h2>
          <ul>
            {owes.map((o, i) => (
              <li key={o.who} className={`flex items-center justify-between gap-3 py-3 ${i ? 'border-t-2 border-ground' : ''}`}>
                <span><span className="block text-[15px] font-bold">{o.who}</span>
                  <span className="text-xs text-ink-2">{o.payments.length} expense{o.payments.length === 1 ? '' : 's'} · {formatRupees(o.amount)}</span></span>
                <button type="button" className="h-9 rounded-control bg-block-2 px-3 text-xs font-extrabold" onClick={async () => {
                  await settleUp(db, o.who);
                  toast({ text: `Settled up with ${o.who}` });
                }}>Settle up</button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
