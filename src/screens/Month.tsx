import { addDays, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import { budgetLines } from '../core/budgets.ts';
import { forecastNextMonth, keptByCancelling, recentUnusual } from '../core/insights.ts';
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
// A trial's first charge reads as the trial ending, so it isn't mistaken for a renewal.
const trialEnding = (plans: Plan[], planId: string, on: Day) => plans.some(p => p.id === planId && p.status === 'trial' && p.trialEnds === on);

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
  const forecast = forecastNextMonth(plans, events, payments, today);
  const unusual = recentUnusual(payments, today)[0] ?? null;
  const kept = keptByCancelling(plans, events, today);
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name;
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
          <a href="#/spent" className="text-[13px] font-extrabold text-on-color underline">What I spent ›</a>
        </div>
      </Block>

      {(next || creep) && (
        <div className={`grid gap-2.5 ${next && creep ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {next && (
            <a href={planHref(next.planId)} className="flex min-h-[112px] flex-col rounded-block bg-soon p-4 text-on-color no-underline active:opacity-80">
              <Kicker>Next up</Kicker>
              <div className="mt-auto font-display text-[26px] leading-tight font-bold">{next.name}</div>
              <div className="text-[13px] font-extrabold">{trialEnding(plans, next.planId, next.on) ? `Trial ends ${when(today, next.on).toLowerCase()}` : when(today, next.on)} · {formatRupees(next.amount)}</div>
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
                    <div className="text-xs text-ink-2">{trialEnding(plans, r.planId, r.on) ? `Trial ends · ${when(today, r.on)}` : when(today, r.on)}</div>
                  </div>
                </div>
                <div className="num text-lg font-bold">{formatRupees(r.amount)}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unusual && (
        // Coral: something to look at. Compared with your own past spending only.
        <Block tone="soon" className="!p-4">
          <Kicker>Unusual spend</Kicker>
          <div className="mt-1 font-display text-2xl leading-tight font-bold">{unusual.payment.name} · {formatRupees(unusual.payment.amount)}</div>
          <div className="text-[13px] font-bold">
            {unusual.times.toFixed(1)}× your usual {categoryName(unusual.payment.categoryId) ?? unusual.payment.name} spend of {formatRupees(unusual.median)}
          </div>
        </Block>
      )}

      {budgets.length > 0 && (
        <section aria-labelledby="budgets" className="rounded-tile bg-block px-4 pt-3 pb-1">
          <h2 id="budgets" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Budgets this month</h2>
          <ul>{budgets.map((b, i) => <li key={b.category.id} className={i ? 'border-t-2 border-ground' : ''}><BudgetBar line={b} /></li>)}</ul>
        </section>
      )}

      {forecast && (
        <section aria-labelledby="forecast" className="rounded-tile bg-block p-4">
          <h2 id="forecast" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
            {new Date(`${forecast.month}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' })}, likely
          </h2>
          <div className="num mt-1 text-[32px] leading-tight font-bold">{formatRupees(forecast.estimate)}</div>
          {forecast.high > forecast.low && (
            <div className="text-sm font-bold">Probably {formatRupees(forecast.low)} – {formatRupees(forecast.high)}</div>
          )}
          <div className="mt-2 text-xs text-ink-2">
            {formatRupees(forecast.fixed)} in {forecast.renewals.length} renewal{forecast.renewals.length === 1 ? '' : 's'}
            {forecast.everyday
              ? ` + about ${formatRupees(forecast.everyday.estimate)} everyday spending (your last ${forecast.everyday.months} month${forecast.everyday.months === 1 ? '' : 's'})`
              : ' · log everyday expenses for a month to include them'}
          </div>
        </section>
      )}

      {kept && kept.kept > 0 && (
        <Block tone="money" className="!p-4">
          <Kicker>Kept since cancelling</Kicker>
          <div className="num mt-1 text-[28px] leading-tight font-bold">{formatRupees(kept.kept)}</div>
          <div className="text-[13px] font-bold">
            {kept.items.length === 1 ? kept.items[0]!.plan.name : `${kept.items.length} plans`} · {formatRupees(kept.perYear)} a year
          </div>
        </Block>
      )}
    </div>
  );
}
