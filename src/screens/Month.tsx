import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Income, Payment, Plan, PlanEvent } from '../core/model.ts';
import { budgetLines } from '../core/budgets.ts';
import { forecastAccuracy, forecastNextMonth, keptByCancelling, pastJumps, recentUnusual, type Unusual } from '../core/insights.ts';
import { billsToPay, monthMoney } from '../core/money-in.ts';
import { duplicatePayments, stillUsing } from '../core/overlap.ts';
import { habits } from '../core/habits.ts';
import { monthSummary } from '../core/summary.ts';
import { ownAmount } from '../core/share.ts';
import type { AtlerDB } from '../data/db.ts';
import { deletePayment, restorePayment } from '../data/actions.ts';
import { useState } from 'react';
import { AnswerButtons, howUnusual, ReviewSheet } from './AlertQuestions.tsx';
import { markPaid, stillUsing as keepUsing, unmarkPaid } from '../data/planActions.ts';
import { useToast } from '../ui/Toast.tsx';
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

const shortDay = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLong = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });

export function Month({ db, plans, events, payments, categories, incomes = [], onAdd }: {
  db: AtlerDB; plans: Plan[]; events: PlanEvent[]; payments: Payment[]; categories: Category[]; incomes?: Income[]; onAdd: () => void;
}) {
  const today = todayDay();
  const toast = useToast();
  const verdicts = useLiveQuery(() => db.verdicts.toArray(), [db]);
  // The jumps as they were when you opened the review, so answering one
  // (which can make another look normal) doesn't reshuffle the list.
  const [reviewing, setReviewing] = useState<Unusual[] | null>(null);

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
  // Wait for your answers before judging, so an answered alert doesn't flash back.
  const unusual = verdicts ? recentUnusual(payments, today, 7, verdicts)[0] ?? null : null;
  const jumps = verdicts ? pastJumps(payments, today, verdicts) : [];
  const kept = keptByCancelling(plans, events, today);
  const next = nextUp(today, plans, events);
  const creep = priceCreep(today, plans, events);
  const dues = billsToPay(plans, events, today);
  const summary = monthSummary(today, plans, events, payments, categories);
  const accuracy = forecastAccuracy(plans, events, payments, today);
  const trials = plans.filter(p => p.status === 'trial' && p.trialEnds && p.trialEnds > today && p.trialEnds <= addDays(today, 7))
    .sort((a, b) => (a.trialEnds! < b.trialEnds! ? -1 : 1));
  const twice = duplicatePayments(payments, today)[0] ?? null;
  const idle = stillUsing(plans, events, today)[0] ?? null;
  const patterns = habits(payments, categories, today).slice(0, 2);
  const money = incomes.length ? monthMoney(today, incomes, plans, events, payments) : null;
  const comingCount = ring.markers.filter(m => m.status === 'coming').length;
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

      {/* Where to go next, each with the number it opens onto. */}
      <nav aria-label="More about your month" className="grid grid-cols-2 gap-2.5">
        {([
          ['#/spent', 'What I spent ›', `${formatRupees(ring.spent)} so far`],
          ['#/calendar', 'Calendar ›', comingCount ? `${comingCount} charge${comingCount === 1 ? '' : 's'} still to come` : 'Nothing more this month'],
          ['#/money', 'Income & goals ›', money ? `${formatRupees(money.left)} left` : 'Add your income'],
          ['#/ask', 'Ask ›', 'Questions about your money'],
        ] as const).map(([href, title, detail]) => (
          <a key={href} href={href} className="flex min-h-[76px] flex-col justify-between rounded-tile bg-block p-3.5 text-ink no-underline active:opacity-70">
            <span className="text-[15px] font-extrabold">{title}</span>
            <span className="num text-xs font-bold text-ink-2">{detail}</span>
          </a>
        ))}
      </nav>

      {money && (
        <a href="#/money" className="grid grid-cols-3 gap-2 rounded-tile bg-block p-4 text-ink no-underline active:opacity-80" aria-label={`This month: ${formatRupees(money.income)} income, ${formatRupees(money.left)} left`}>
          <div><Kicker className="text-ink-2">Income</Kicker><div className="num text-lg font-bold">{formatRupees(money.income)}</div></div>
          <div><Kicker className="text-ink-2">Left</Kicker><div className={`num text-lg font-bold ${money.left < 0 ? 'text-danger' : ''}`}>{formatRupees(money.left)}</div></div>
          <div><Kicker className="text-ink-2">Saving</Kicker><div className="num text-lg font-bold">{money.savingsRate === null ? '–' : `${Math.round(money.savingsRate * 100)}%`}</div></div>
        </a>
      )}

      {dues.length > 0 && (
        // Coral: money you still have to send yourself.
        <section aria-labelledby="to-pay" className="rounded-block bg-soon p-4 text-on-color">
          <h2 id="to-pay" className="text-[11px] font-extrabold tracking-[0.1em] uppercase">{dues.some(d => d.overdue) ? 'To pay · overdue' : 'To pay'}</h2>
          <ul className="mt-1">
            {dues.slice(0, 5).map(d => (
              <li key={d.plan.id + d.on} className="flex items-center justify-between gap-3 py-1.5">
                <a href={planHref(d.plan.id)} className="min-w-0 text-on-color no-underline">
                  <span className="block truncate text-[15px] font-bold">{d.plan.name} · {formatRupees(d.amount)}</span>
                  <span className="text-xs font-bold">{d.overdue ? `Was due ${shortDay(d.on)}` : `Due ${when(today, d.on).toLowerCase()}`}</span>
                </a>
                <button type="button" onClick={() => {
                  void markPaid(db, d.plan, d.on);
                  toast({ text: `${d.plan.name} marked paid`, action: { label: 'Undo', run: () => void unmarkPaid(db, d.plan.id, d.on) } });
                }} className="h-9 shrink-0 rounded-control bg-on-color/15 px-3 text-xs font-extrabold">Mark paid</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary && (
        <section aria-labelledby="last-month" className="rounded-tile bg-block p-4">
          <h2 id="last-month" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">{monthLong(summary.month)} in short</h2>
          <div className="num mt-1 text-[28px] leading-tight font-bold">{formatRupees(summary.total)}</div>
          {summary.change !== null && <div className="text-sm font-bold">{formatRupees(summary.change, { sign: true })} on the month before</div>}
          <ul className="mt-2 flex flex-col gap-1 text-sm">{summary.lines.map(l => <li key={l}>{l}</li>)}</ul>
          {summary.tip && <p className="mt-2 rounded-xl bg-block-2 px-3 py-2 text-sm font-bold">Try this: {summary.tip}</p>}
        </section>
      )}

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

      {trials.length > 0 && (
        <section aria-labelledby="trials" className="rounded-tile bg-block p-4">
          <h2 id="trials" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Trials ending this week</h2>
          <p className="mt-1 text-xs text-ink-2">Keep it or cancel before it turns into a charge.</p>
          <ul className="mt-1">
            {trials.map(p => (
              <li key={p.id}>
                <a href={planHref(p.id)} className="flex items-center justify-between py-2 text-ink no-underline">
                  <span className="text-[15px] font-bold">{p.name}</span>
                  <span className="text-sm font-bold text-soon">{when(today, p.trialEnds!)} · then {formatRupees(p.price)} ›</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {twice && (
        <Block className="!p-4">
          <Kicker className="text-ink-2">Logged twice?</Kicker>
          <div className="mt-1 text-[15px] font-bold">{twice[0].name} · {formatRupees(ownAmount(twice[0]))} on {shortDay(twice[0].on)}, twice</div>
          <button type="button" className="mt-2 h-10 rounded-control bg-block-2 px-4 text-sm font-bold" onClick={() => {
            const copy = twice[1];
            void deletePayment(db, copy.id);
            toast({ text: 'Copy deleted', action: { label: 'Undo', run: () => void restorePayment(db, copy.id) } });
          }}>Delete the copy</button>
        </Block>
      )}

      {idle && (
        <Block className="!p-4">
          <Kicker className="text-ink-2">Still using it?</Kicker>
          <div className="mt-1 font-display text-2xl leading-tight font-bold">{idle.plan.name}</div>
          <div className="text-[13px] font-bold text-ink-2">{formatRupees(idle.lastSixMonths)} in the last 6 months · {formatRupees(idle.perMonth)} a month</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="h-10 rounded-control bg-block-2 text-sm font-bold" onClick={() => void keepUsing(db, idle.plan, today)}>Yes, I use it</button>
            <a href={planHref(idle.plan.id)} className="flex h-10 items-center justify-center rounded-control bg-here text-sm font-extrabold text-on-color no-underline">How to cancel</a>
          </div>
        </Block>
      )}

      {unusual && (
        // Coral: something to look at. Compared with your own past spending only.
        // Your answer tunes what counts as unusual for you (core/alertFeedback.ts).
        <Block tone="soon" className="!p-4">
          <Kicker>Unusual spend</Kicker>
          <div className="mt-1 font-display text-2xl leading-tight font-bold">{unusual.payment.name} · {formatRupees(unusual.payment.amount)}</div>
          <div className="text-[13px] font-bold">
            {howUnusual(unusual)}
          </div>
          <AnswerButtons db={db} unusual={unusual} />
        </Block>
      )}

      {jumps.length > 0 && !unusual && (
        <Block className="!p-4">
          <Kicker className="text-ink-2">Teach ATLER what’s unusual for you</Kicker>
          <div className="mt-1 text-sm font-bold">{jumps.length === 1 ? 'One big jump' : `${jumps.length} big jumps`} in your spending so far. Were {jumps.length === 1 ? 'it' : 'they'} expected?</div>
          <button type="button" className="mt-3 h-10 w-full rounded-control bg-block-2 text-sm font-bold" onClick={() => setReviewing(jumps)}>Take a look</button>
        </Block>
      )}
      <ReviewSheet db={db} jumps={reviewing ?? []} open={!!reviewing} onClose={() => setReviewing(null)} />

      {budgets.length > 0 && (
        <section aria-labelledby="budgets" className="rounded-tile bg-block px-4 pt-3 pb-1">
          <h2 id="budgets" className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Budgets this month</h2>
          <ul>{budgets.map((b, i) => <li key={b.category.id} className={i ? 'border-t-2 border-ground' : ''}><BudgetBar line={b} /></li>)}</ul>
        </section>
      )}

      {patterns.map(h => (
        <Block key={h.id} className="!p-4">
          <Kicker className="text-ink-2">Pattern</Kicker>
          <div className="mt-1 text-[17px] leading-tight font-bold">{h.title}</div>
          <div className="mt-1 text-[13px] text-ink-2">{h.body}</div>
        </Block>
      ))}

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
            {forecast.everyday?.seasonal ? ` · ${monthLong(forecast.month)} ran ${forecast.everyday.seasonal > 1 ? `${Math.round((forecast.everyday.seasonal - 1) * 100)}% busier` : `${Math.round((1 - forecast.everyday.seasonal) * 100)}% quieter`} than usual last year` : ''}
          </div>
          {accuracy && (
            <div className="mt-2 text-xs font-bold text-ink-2">
              {monthLong(accuracy.month)}: forecast {formatRupees(accuracy.forecast)}, actual {formatRupees(accuracy.actual)} ({accuracy.off < 0.005 ? 'spot on' : `off by ${Math.round(accuracy.off * 100)}%`})
            </div>
          )}
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
