import { today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import { trackingSince } from '../core/month.ts';
import { yearReview, type YearLine } from '../core/year.ts';
import { planHref } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { useSlide } from '../ui/useSlide.ts';

const short = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
const long = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
const dayLabel = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Lines({ label, lines, total, of }: { label: string; lines: YearLine[]; total: number; of: string }) {
  return (
    <Block className="!p-4">
      <Kicker className="text-ink-2">{label}</Kicker>
      <ul className="mt-1">
        {lines.map((l, i) => (
          <li key={l.planId ?? l.categoryId ?? l.name} className={`py-2.5 ${i ? 'border-t-2 border-ground' : ''}`}>
            <div className="flex justify-between">
              {l.planId ? <a href={planHref(l.planId)} className="font-bold text-ink">{l.name}</a> : <span className="font-bold">{l.name}</span>}
              <span className="num font-bold">{formatRupees(l.amount)}</span>
            </div>
            {/* Share: how much of the group's total this one line was. */}
            <div className="mt-1.5 h-1.5 rounded-full bg-block-2" role="img" aria-label={`${Math.round((l.amount / total) * 100)}% of ${of}`}>
              <div className="h-full rounded-full bg-money" style={{ width: `${Math.max(2, (l.amount / total) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function Year({ year, plans, events, payments, categories }: { year: number; plans: Plan[]; events: PlanEvent[]; payments: Payment[]; categories: Category[] }) {
  const today = todayDay();
  const slide = useSlide(String(year));
  const since = trackingSince(plans, payments);
  const r = yearReview(year, today, plans, events, payments, categories, since);
  const max = Math.max(...r.months.map(m => m.total ?? 0), 1);
  const thisYear = Number(today.slice(0, 4));
  const firstYear = since ? Number(since.slice(0, 4)) : thisYear;
  const navCls = 'flex size-10 items-center justify-center rounded-xl bg-on-color/10 text-on-color no-underline';

  return (
    <div className="flex flex-col gap-2.5">
      <Block tone="money" className="!p-4">
        <div className="flex items-center justify-between">
          {year > firstYear ? <a href={`#/year/${year - 1}`} aria-label={`Previous year, ${year - 1}`} className={navCls}>‹</a> : <span className="size-10" aria-hidden="true" />}
          <Kicker>{year === thisYear ? `${year} so far` : `Your ${year}`}</Kicker>
          {year < thisYear ? <a href={`#/year/${year + 1}`} aria-label={`Next year, ${year + 1}`} className={navCls}>›</a> : <span className="size-10" aria-hidden="true" />}
        </div>
        <div key={year} className={`num mt-2 text-center text-[40px] leading-none font-bold ${slide}`}>{formatRupees(r.total)}</div>
        {r.total > 0 && (
          <p className="mt-2 text-center text-[13px] font-bold">{formatRupees(r.plansTotal)} on plans · {formatRupees(r.everydayTotal)} everyday</p>
        )}
      </Block>

      <div key={year} className={`flex flex-col gap-2.5 ${slide}`}>
      {r.total === 0 ? <Block><p className="text-sm text-ink-2">Nothing tracked in {year}.</p></Block> : <>
        <Block className="!p-4">
          <Kicker className="text-ink-2">Month by month</Kicker>
          <div className="mt-3 flex h-28 items-end gap-1" role="img"
            aria-label={r.months.filter(m => m.total !== null).map(m => `${long(m.month)} ${formatRupees(m.total!)}`).join(', ')}>
            {r.months.map(m => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {m.total === null
                  ? <div className="h-0.5 w-full rounded-full bg-block-2" />
                  : <div className={`w-full rounded-md ${m.month === r.busiest?.month ? 'bg-here' : 'bg-money'}`} style={{ height: `${Math.max(4, (m.total / max) * 100)}%` }} />}
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-center text-[9px] font-extrabold text-ink-2" aria-hidden="true">
            {r.months.map(m => <span key={m.month} className="flex-1">{short(m.month).slice(0, 1)}</span>)}
          </div>
          <p className="mt-2 text-xs font-bold text-ink-2">
            One bar per month{r.busiest ? ` · white = busiest, ${long(r.busiest.month)} (${formatRupees(r.busiest.total!)})` : ''}
          </p>
        </Block>

        {r.topPlans.length > 0 && <Lines label="Plans that cost the most" lines={r.topPlans} total={r.plansTotal} of="all plans" />}
        {r.topCategories.length > 1 && <Lines label="Where it went" lines={r.topCategories} total={r.total} of="the year" />}

        {r.biggestExpense && (
          <Block className="!p-4">
            <Kicker className="text-ink-2">Biggest single expense</Kicker>
            <div className="mt-1 flex justify-between"><span className="font-bold">{r.biggestExpense.name} <span className="text-xs text-ink-2">{dayLabel(r.biggestExpense.on)}</span></span>
              <span className="num font-bold">{formatRupees(r.biggestExpense.amount)}</span></div>
          </Block>
        )}

        {r.priceRises.length > 0 && (
          <Block className="!p-4">
            <Kicker className="text-soon">Price rises this year</Kicker>
            <ul className="mt-1">{r.priceRises.map((p, i) => (
              <li key={`${p.planId}${p.on}`} className={`flex justify-between py-2.5 ${i ? 'border-t-2 border-ground' : ''}`}>
                <a href={planHref(p.planId)} className="font-bold text-ink">{p.name} <span className="text-xs text-ink-2">{dayLabel(p.on)}</span></a>
                <span className="num font-bold text-soon">{formatRupees(p.from)} → {formatRupees(p.to)}</span>
              </li>))}</ul>
          </Block>
        )}

        {r.cancelled.length > 0 && (
          <Block className="!p-4">
            <Kicker className="text-ink-2">Cancelled this year</Kicker>
            <p className="mt-1 text-sm font-bold">{r.cancelled.map(c => c.name).join(', ')}</p>
          </Block>
        )}
      </>}
      </div>
    </div>
  );
}
