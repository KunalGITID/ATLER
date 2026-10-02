import { describeCycle, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Plan, PlanEvent } from '../core/model.ts';
import { plansSummary, type PlanRow } from '../core/plans.ts';
import { planHref } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { PLAN_KINDS } from '../core/model.ts';
import { overlaps } from '../core/overlap.ts';
import { isAutopay, planKind, planPrice, sharedBy } from '../core/share.ts';

// "11 Oct" this year, "23 Aug 2027" otherwise, so a date is never ambiguous.
const short = (d: Day, today: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', ...(d.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}), timeZone: 'UTC',
});

function Row({ row, first, today }: { row: PlanRow; first: boolean; today: Day }) {
  const { plan } = row;
  const billing = plan.status === 'active' || plan.status === 'trial';
  const trialRunning = plan.status === 'trial' && plan.trialEnds !== null && plan.trialEnds > today;
  const status = plan.status === 'paused' ? 'Paused' : plan.status === 'cancelled' ? 'Cancelled'
    : trialRunning ? `Trial · ends ${short(plan.trialEnds!, today)}`
    : row.next ? `Next ${short(row.next, today)}` : '';
  return (
    <li className={first ? '' : 'border-t-2 border-ground'}>
      <a href={planHref(plan.id)} className="block py-3 text-ink no-underline active:opacity-70">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold">{plan.name}</div>
            <div className="text-xs text-ink-2">
              {planKind(plan) !== 'subscription' ? `${PLAN_KINDS[planKind(plan)]} · ` : ''}{describeCycle(plan.cycle)} · {formatRupees(planPrice(plan))}
              {sharedBy(plan) > 1 ? ` (your share of ${formatRupees(plan.price)})` : ''}{!isAutopay(plan) ? ' · paid by hand' : ''} · {status}
            </div>
          </div>
          {billing
            ? <div className="num shrink-0 text-lg font-bold">{formatRupees(row.perMonth)}<span className="text-xs text-ink-2">/mo</span></div>
            // Not billing: what it would cost, in grey, so it never reads as money going out.
            : <div className="num shrink-0 text-right text-sm font-bold text-ink-2">{formatRupees(row.perMonth)}/mo<div className="font-sans text-[11px] font-semibold">if restarted</div></div>}
        </div>
        {row.share > 0 && (
          // This plan's share of everything you pay per month.
          <div className="mt-2 h-1.5 rounded-full bg-block-2" role="img" aria-label={`${Math.round(row.share * 100)}% of your monthly plans`}>
            <div className="h-full rounded-full bg-money" style={{ width: `${Math.max(2, row.share * 100)}%` }} />
          </div>
        )}
      </a>
    </li>
  );
}

function Group({ title, rows, today }: { title: string; rows: PlanRow[]; today: Day }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title} className="rounded-tile bg-block px-4 pt-3 pb-1">
      <Kicker className="text-ink-2">{title} · {rows.length}</Kicker>
      <ul>{rows.map((r, i) => <Row key={r.plan.id} row={r} first={i === 0} today={today} />)}</ul>
    </section>
  );
}

export function Plans({ plans, events, onAdd }: { plans: Plan[]; events: PlanEvent[]; onAdd: () => void }) {
  const today = todayDay();
  const s = plansSummary(plans, events, today);
  if (!plans.length) {
    return (
      <Block tone="money" className="flex flex-col gap-3">
        <Kicker>No plans yet</Kicker>
        <p className="font-display text-[28px] leading-tight font-bold">Every subscription you add lands here, biggest cost first.</p>
        <Button kind="plain" onClick={onAdd}>Add a plan</Button>
      </Block>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <Block tone="money" className="flex items-end justify-between !p-4">
        <div>
          <Kicker>Your plans cost</Kicker>
          <div className="num mt-1 text-[40px] leading-none font-bold">{formatRupees(s.perMonth)}<span className="text-lg">/mo</span></div>
        </div>
        <div className="text-right">
          <Kicker>Per year</Kicker>
          <div className="num mt-1 text-xl font-bold">{formatRupees(s.perYear)}</div>
        </div>
      </Block>
      {overlaps(plans).slice(0, 2).map(o => (
        <Block key={o.group + o.plans.map(p => p.id).join()} tone="soon" className="!p-4">
          <Kicker>{o.group === 'bundle' ? 'Paying twice' : `Overlap · ${o.group}`}</Kicker>
          <div className="mt-1 text-[15px] font-bold">{o.plans.map(p => p.name).join(' + ')}</div>
          <div className="text-[13px] font-bold">{o.note} {o.group === 'bundle' ? 'The extra costs' : 'Together'} {formatRupees(o.perMonth)}/mo.</div>
        </Block>
      ))}
      <Group title="Billing" rows={s.billing} today={today} />
      <Group title="Paused" rows={s.paused} today={today} />
      <Group title="Cancelled" rows={s.cancelled} today={today} />
    </div>
  );
}
