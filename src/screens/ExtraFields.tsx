// The less common parts of a plan or an expense, folded away under
// "More options" so the everyday case stays four fields long.
import { useId, type ReactNode } from 'react';
import { formatRupees, type Paise } from '../core/money.ts';
import { PLAN_KINDS, type PlanKind, type Split } from '../core/model.ts';
import { evenSplit } from '../core/money-in.ts';
import { Field } from '../ui/Field.tsx';

export function More({ children, open }: { children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-block px-3 py-2">
      <summary className="cursor-pointer list-none py-1 text-sm font-bold text-money">
        <span className="group-open:hidden">+ More options</span><span className="hidden group-open:inline">− More options</span>
      </summary>
      <div className="mt-2 flex flex-col gap-3 pb-1">{children}</div>
    </details>
  );
}

function Switch({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (on: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-xs text-ink-2">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-money' : 'bg-block-2'}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-ground transition-[left] ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// Plan type, paid automatically or by hand, last charge, shared with.
export interface PlanExtrasValue { kind: PlanKind; autopay: boolean; endsOn: string; sharedBy: string }
export const planExtras = (p?: { kind?: PlanKind; autopay?: boolean; endsOn?: string | null; sharedBy?: number }): PlanExtrasValue =>
  ({ kind: p?.kind ?? 'subscription', autopay: p?.autopay ?? true, endsOn: p?.endsOn ?? '', sharedBy: String(p?.sharedBy ?? 1) });

export function PlanTypeField({ value, onChange }: { value: PlanExtrasValue; onChange: (v: PlanExtrasValue) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">Type</label>
      <select id={id} value={value.kind}
        // Rent, bills and EMIs are usually paid by hand; subscriptions charge themselves.
        onChange={e => { const kind = e.target.value as PlanKind; onChange({ ...value, kind, autopay: kind === 'subscription' || kind === 'sip' || kind === 'insurance' }); }}
        className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money">
        {Object.entries(PLAN_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    </div>
  );
}

export function PlanExtras({ value, onChange, price }: { value: PlanExtrasValue; onChange: (v: PlanExtrasValue) => void; price: Paise | null }) {
  const people = Math.max(1, Math.floor(Number(value.sharedBy) || 1));
  return (
    <>
      <Switch label="Paid automatically" hint={value.autopay ? 'Counted as paid on its day.' : 'ATLER asks you to mark each one paid.'} on={value.autopay} onChange={autopay => onChange({ ...value, autopay })} />
      <Field label="Last charge on (optional)" type="date" value={value.endsOn} onChange={e => onChange({ ...value, endsOn: e.target.value })} />
      <p className="-mt-2 text-xs text-ink-2">For an EMI or a fixed term: nothing is counted after this day.</p>
      <Field label="People sharing it (you included)" inputMode="numeric" value={value.sharedBy} onChange={e => onChange({ ...value, sharedBy: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
      {people > 1 && price !== null && <p className="-mt-2 text-xs font-bold text-ink-2">Your share: {formatRupees(Math.round(price / people) as Paise)} of {formatRupees(price)}.</p>}
    </>
  );
}

// Note, tags, and who's splitting it with you.
export interface ExpenseExtrasValue { note: string; tags: string; splitWith: string; split: Split[] }
export const expenseExtras = (p?: { note?: string; tags?: string[]; split?: Split[] }): ExpenseExtrasValue =>
  ({ note: p?.note ?? '', tags: (p?.tags ?? []).join(', '), splitWith: (p?.split ?? []).map(s => s.who).join(', '), split: p?.split ?? [] });

export const parseTags = (text: string) => [...new Set(text.split(/[,#]/).map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
export const parseNames = (text: string) => [...new Set(text.split(',').map(t => t.trim()).filter(Boolean))].slice(0, 20);

// The split to save: people already in it keep their amount and settled
// state when the total hasn't changed; new names get an even share.
export function splitFor(v: ExpenseExtrasValue, amount: Paise, previousAmount?: Paise): Split[] {
  const names = parseNames(v.splitWith);
  const even = evenSplit(amount, names);
  return even.map(e => {
    const old = v.split.find(s => s.who.toLowerCase() === e.who.toLowerCase());
    return old && previousAmount === amount && names.length === v.split.length ? old : { ...e, settled: old?.settled ?? false };
  });
}

export function ExpenseExtras({ value, onChange, amount }: { value: ExpenseExtrasValue; onChange: (v: ExpenseExtrasValue) => void; amount: Paise | null }) {
  const names = parseNames(value.splitWith);
  return (
    <>
      <Field label="Note" value={value.note} maxLength={500} onChange={e => onChange({ ...value, note: e.target.value })} placeholder="Birthday dinner" autoComplete="off" />
      <Field label="Tags" value={value.tags} onChange={e => onChange({ ...value, tags: e.target.value })} placeholder="goa trip, work" autoComplete="off" />
      <Field label="Split with" value={value.splitWith} onChange={e => onChange({ ...value, splitWith: e.target.value })} placeholder="Asha, Ravi" autoComplete="off" />
      {names.length > 0 && amount !== null && (
        <p className="-mt-2 text-xs font-bold text-ink-2">
          Split evenly: each owes you {formatRupees(evenSplit(amount, names)[0]!.amount)}; your part is {formatRupees((amount - evenSplit(amount, names).reduce((a, b) => a + b.amount, 0)) as Paise)}.
        </p>
      )}
    </>
  );
}
