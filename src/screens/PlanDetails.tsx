import { useState } from 'react';
import { describeCycle, today as todayDay, type Day } from '../core/dates.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Plan, PlanEvent } from '../core/model.ts';
import { planView } from '../core/plan.ts';
import type { AtlerDB } from '../data/db.ts';
import { deletePlan, restorePlan, setRemind, setStatus } from '../data/planActions.ts';
import { useToast } from '../ui/Toast.tsx';
import type { PushState } from '../data/push.ts';
import { Segmented } from '../ui/Segmented.tsx';
import type { Remind } from '../core/model.ts';
import { goBack } from '../route.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { CountdownRing } from '../ui/CountdownRing.tsx';
import { PaymentBars } from '../ui/PaymentBars.tsx';
import { ConfirmSheet, EditPlanSheet } from './PlanSheets.tsx';

const fmtDay = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const perLabel = (p: Plan) => (p.cycle.unit === 'month' && p.cycle.every === 1 ? '/MO' : p.cycle.unit === 'year' && p.cycle.every === 1 ? '/YR' : '');

export function PlanDetails({ db, plan, events, categories, push, onEnablePush }: {
  db: AtlerDB; plan: Plan; events: PlanEvent[]; categories: Category[]; push: PushState; onEnablePush: () => void;
}) {
  const today = todayDay();
  const v = planView(plan, events, today);
  const [sheet, setSheet] = useState<'edit' | 'cancel' | null>(null);
  const toast = useToast();
  const close = () => setSheet(null);

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={goBack} className="inline-flex items-center gap-1 self-start px-1 pb-1.5 text-[15px] font-bold">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back
      </button>

      {/* Coral only when a charge is a week or less away: that's what coral means. */}
      <Block tone={v.soon ? 'soon' : 'dark'} className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-[32px] leading-none font-bold">{plan.name}</h1>
          <div className="num mt-2 text-[44px] leading-none font-bold">
            {formatRupees(plan.price)}<span className="text-lg">{perLabel(plan)}</span>
          </div>
          <div className={`mt-2 text-sm font-bold ${v.soon ? '' : 'text-ink-2'}`}>
            {plan.status === 'paused' && v.stoppedOn ? `Paused since ${fmtDay(v.stoppedOn)}`
              : plan.status === 'cancelled' && v.stoppedOn ? `Cancelled ${fmtDay(v.stoppedOn)}`
              : v.trial && plan.trialEnds ? `Free trial · converts ${fmtDay(plan.trialEnds)}`
              : `${describeCycle(plan.cycle)} · next ${v.countdown ? fmtDay(v.countdown.end) : ''}`}
          </div>
        </div>
        {v.countdown && (
          <div className={v.soon ? '' : 'rounded-[22px] bg-money p-1.5'}>
            <CountdownRing done={v.countdown.done} left={v.countdown.left} total={v.countdown.total} trial={v.trial} />
          </div>
        )}
      </Block>

      {plan.status === 'cancelled' && v.saved > 0 && (
        <Block tone="money" className="!p-4">
          <Kicker>Kept since cancelling</Kicker>
          <div className="num mt-1 text-[30px] leading-tight font-bold">{formatRupees(v.saved)}</div>
          <div className="text-[13px] font-bold">and {formatRupees(v.perYear)} every year</div>
        </Block>
      )}

      {v.history.length > 0 && (
        <Block className="!p-4">
          <div className="mb-3.5 flex justify-between">
            <Kicker className="text-ink-2">Paid so far</Kicker>
            <span className="num text-sm font-bold">{formatRupees(v.paidSoFar)}</span>
          </div>
          <PaymentBars history={v.history} current={plan.price} />
        </Block>
      )}

      {(plan.status === 'active' || plan.status === 'trial') && (
        <Block className="flex flex-col gap-3 !p-4">
          <h2 className="text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">Remind me</h2>
          {v.trial
            ? <p className="text-sm font-bold">3 days and 1 day before the trial turns into a charge.</p>
            : <Segmented
                label="Remind me before it renews"
                value={plan.remind}
                onChange={(r: Remind) => { void setRemind(db, plan, r); if (r !== 'off' && push === 'off') onEnablePush(); }}
                options={[{ value: 'off', label: 'Off' }, { value: '3d', label: '3 days' }, { value: '1d', label: '1 day' }, { value: 'both', label: 'Both' }]}
              />}
          {(v.trial || plan.remind !== 'off') && push !== 'on' && (
            <p role="status" className="text-xs font-bold text-soon">
              {push === 'denied' ? 'Notifications are blocked for ATLER in this browser’s settings.'
                : push === 'unsupported' ? 'This browser can’t show reminders. On iPhone, add ATLER to the Home Screen first.'
                : <button type="button" onClick={onEnablePush} className="underline">Turn on notifications to get it</button>}
            </p>
          )}
        </Block>
      )}

      <Block className="!px-4 !py-1">
        <dl aria-label="About this plan" className="text-sm">
          {([
            ['Per year', <span key="y" className="num">{formatRupees(v.perYear)}</span>],
            ['Category', categories.find(c => c.id === plan.categoryId)?.name ?? 'None'],
            ['Tracked since', fmtDay(plan.createdOn)],
          ] as const).map(([term, value], i) => (
            <div key={term} className={`flex justify-between py-3 ${i ? 'border-t-2 border-ground' : ''}`}>
              <dt className="text-ink-2">{term}</dt>
              <dd className="m-0 font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Button kind="plain" onClick={() => setSheet('edit')}>Edit</Button>
        {plan.status === 'active' || plan.status === 'trial'
          ? <Button kind="quiet" className="!h-14 !rounded-[20px]" onClick={() => setStatus(db, plan, 'pause', today)}>Pause</Button>
          : plan.status === 'paused'
            ? <Button kind="quiet" className="!h-14 !rounded-[20px]" onClick={() => setStatus(db, plan, 'resume', today)}>Resume</Button>
            : <Button kind="quiet" className="!h-14 !rounded-[20px]" onClick={() => setStatus(db, plan, 'restart', today)}>Restart</Button>}
      </div>
      {plan.status !== 'cancelled' && (
        <Button kind="primary" className="!text-base" onClick={() => setSheet('cancel')}>I CANCELLED IT · KEEP {formatRupees(v.perYear)}/YR</Button>
      )}
      <Button kind="danger" onClick={async () => {
        await deletePlan(db, plan);
        location.hash = '#/';
        toast({ text: `${plan.name} deleted`, action: { label: 'Undo', run: () => void restorePlan(db, plan.id) } });
      }}>Delete</Button>

      <EditPlanSheet key={plan.id + plan.price + plan.name + plan.categoryId} db={db} plan={plan} categories={categories} open={sheet === 'edit'} onClose={close} />
      <ConfirmSheet
        open={sheet === 'cancel'}
        title={`Cancelled ${plan.name}?`}
        body={`ATLER stops counting its charges from today and shows what you keep: ${formatRupees(v.perYear)} a year.`}
        confirm="Yes, I cancelled it"
        onConfirm={async () => { await setStatus(db, plan, 'cancel', today); close(); }}
        onClose={close}
      />

    </div>
  );
}
