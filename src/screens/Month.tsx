import { addDays, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import { budgetLines } from '../core/budgets.ts';
import { BudgetBar } from '../ui/BudgetBar.tsx';
import { canCompareWithLastMonth, monthRing, nextUp, plansPerMonth, priceCreep, vsLastMonth } from '../core/month.ts';
import { renewalsBetween } from '../core/renewals.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { planHref } from '../route.ts';
import { MonthRing } from '../ui/MonthRing.tsx';

const monthName = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).toUpperCase();
// Date.UTC rolls month -1 back into December of the year before.
const lastMonthName = (d: Day) =>
  new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 2, 1)).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' }).toUpperCase();
function when(today: Day, on: Day) {
  const n = Math.round((Date.parse(on) - Date.parse(today)) / 86_400_000);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}

export function Month({ plans, events, payments, categories, onAdd }: {
  plans: Plan[]; events: PlanEvent[]; payments: Payment[]; categories: Category[]; onAdd: () => void;
}) {
  const today = todayDay();

  if (!plans.length && !payments.length) {
    return (
      <Block tone="money" className="flex flex-col gap-3">
        <Kicker>Your month is empty</Kicker>
        <p className="font-display text-[28px] leading-tight font-bold">Add a plan and ATLER draws your month: what's paid, what's coming.</p>
        <Button kind="plain" onClick={onAdd}>Add your first plan</Button>
      </Block>
    );
  }

  const ring = monthRing(today, plans, events, payments);
  const compare = canCompareWithLastMonth(today, plans, payments);
  const budgets = budgetLines(today, categories, plans, events, payments);
  const next = nextUp(today, plans, events);
  const creep = priceCreep(today, plans, events);
  // The list continues after the "Next up" tile, so nothing is shown twice.
  const coming = plans.flatMap(p => renewalsBetween(p, events, addDays(today, 1), addDays(today, 30)))
    .sort((a, b) => (a.on < b.on ? -1 : 1))
    .filter(r => !(next && r.planId === next.planId && r.on === next.on))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-2.5">
      <Block tone="money" className="flex items-center gap-3.5 !p-4">
        <MonthRing ring={ring} label={`${monthName(today)} ${Number(today.slice(8))}`} />
        <div className="flex flex-col gap-2.5">
          <div><Kicker>Still to come</Kicker><div className="num text-2xl leading-tight font-bold">{formatRupees(ring.toCome)}</div></div>
          {compare
            ? <div><Kicker>vs {lastMonthName(today)}</Kicker><div className="num text-2xl leading-tight font-bold">{formatRupees(vsLastMonth(today, plans, events, payments), { sign: true })}</div></div>
            : <div><Kicker>Plans per month</Kicker><div className="num text-2xl leading-tight font-bold">{formatRupees(plansPerMonth(plans))}</div></div>}
          <div className="flex flex-col gap-1 text-[11px] font-extrabold">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-on-color" />Paid</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-soon ring-2 ring-on-color" />Coming</span>
          </div>
        </div>
      </Block>

      {(next || creep) && (
        <div className={`grid gap-2.5 ${next && creep ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {next && (
            <a href={planHref(next.planId)} className="flex min-h-[112px] flex-col rounded-block bg-soon p-4 text-on-color no-underline active:opacity-80">
              <Kicker>Next up</Kicker>
              <div className="mt-auto font-display text-[26px] leading-tight font-bold">{next.name}</div>
              <div className="text-[13px] font-extrabold">{when(today, next.on)} · {formatRupees(next.amount)}</div>
            </a>
          )}
          {creep && (
            <a href={planHref(creep.plan.id)} className="flex min-h-[112px] flex-col rounded-block bg-block p-4 text-ink no-underline active:opacity-80">
              <Kicker className="text-ink-2">Price creep</Kicker>
              <div className="num mt-auto text-[26px] leading-tight font-bold">{formatRupees(creep.perYear, { sign: true })}/yr</div>
              <div className="text-[13px] font-bold text-ink-2">{creep.plan.name} went up</div>
            </a>
          )}
        </div>
      )}

      {coming.length > 0 && (
        <section aria-labelledby="coming-up" className="rounded-tile bg-block px-3.5 py-1.5">
          <h2 id="coming-up" className="sr-only">Coming up</h2>
          <ul>
            {coming.map((r, i) => (
              <li key={r.planId + r.on} className={i ? 'border-t-2 border-ground' : ''}>
                <a href={planHref(r.planId)} className="flex items-center justify-between py-2.5 text-ink no-underline active:opacity-70">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 flex-col items-center justify-center rounded-[13px] bg-block-2" aria-hidden="true">
                    <div className="num text-[17px] leading-none font-bold">{Number(r.on.slice(8))}</div>
                    <div className="text-[9px] font-extrabold text-ink-2">{monthName(r.on)}</div>
                  </div>
                  <div>
                    <div className="text-[15px] font-bold">{r.name}</div>
                    <div className="text-xs text-ink-2">{when(today, r.on)}</div>
                  </div>
                </div>
                <div className="num text-lg font-bold">{formatRupees(r.amount)}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {budgets.length > 0 && (
        <section aria-labelledby="budgets" className="rounded-tile bg-block px-4 pt-3 pb-1">
          <h2 id="budgets" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Budgets this month</h2>
          <ul>{budgets.map((b, i) => <li key={b.category.id} className={i ? 'border-t-2 border-ground' : ''}><BudgetBar line={b} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
