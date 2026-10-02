import { useId } from 'react';
import { formatForeign, impliedRate, isCurrency, parseForeign, parseRate, toRupees, foreignText } from '../core/fx.ts';
import { formatRupees, parseRupees, type Paise } from '../core/money.ts';
import { CURRENCIES, type Currency, type Foreign } from '../core/model.ts';

// An amount in rupees, or in another currency at a rate you set.
export interface MoneyValue { amount: string; currency: 'INR' | Currency; rate: string }

const rateKey = (c: Currency) => `atler:rate:${c}`;
const rememberedRate = (c: Currency) => { try { return localStorage.getItem(rateKey(c)) ?? ''; } catch { return ''; } };
const rememberRate = (c: Currency, rate: string) => { try { localStorage.setItem(rateKey(c), rate); } catch { /* private mode: fine */ } };

export const moneyValue = (inr?: Paise, foreign?: Foreign | null): MoneyValue => foreign
  ? { amount: foreignText(foreign), currency: foreign.currency, rate: String(impliedRate(foreign, inr ?? (0 as Paise)) ?? '') }
  : { amount: inr !== undefined ? String(inr / 100) : '', currency: 'INR', rate: '' };

export type Resolved = { ok: true; inr: Paise; foreign: Foreign | null } | { ok: false; error: string };

export function resolveMoney(v: MoneyValue): Resolved {
  if (v.currency === 'INR') {
    const inr = parseRupees(v.amount);
    return inr === null || inr <= 0 ? { ok: false, error: 'Enter an amount like 199 or 199.50.' } : { ok: true, inr, foreign: null };
  }
  const amount = parseForeign(v.amount, v.currency);
  if (amount === null || amount <= 0) return { ok: false, error: `Enter the amount in ${v.currency}, like 20 or 19.99.` };
  const rate = parseRate(v.rate);
  if (rate === null) return { ok: false, error: `Enter how many rupees 1 ${v.currency} costs you, like 85.50.` };
  const foreign = { currency: v.currency, amount };
  return { ok: true, inr: toRupees(foreign, rate), foreign };
}

// Remember the rate you used, to prefill it next time (call on save).
export const keepRate = (v: MoneyValue) => { if (v.currency !== 'INR') rememberRate(v.currency, v.rate); };

export function MoneyInput({ label, value, onChange }: { label: (unit: string) => string; value: MoneyValue; onChange: (v: MoneyValue) => void }) {
  const id = useId();
  const resolved = value.currency !== 'INR' ? resolveMoney(value) : null;
  const inputCls = 'h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none placeholder:text-ink-2/60 focus:border-money';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={`${id}-a`} className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">{label(value.currency === 'INR' ? '₹' : value.currency)}</label>
          <input id={`${id}-a`} inputMode="decimal" placeholder={value.currency === 'INR' ? '199' : '20'} value={value.amount} onChange={e => onChange({ ...value, amount: e.target.value })} className={inputCls} />
        </div>
        <select aria-label="Currency" value={value.currency}
          onChange={e => { const c = e.target.value; onChange({ ...value, currency: c === 'INR' || !isCurrency(c) ? 'INR' : c, rate: isCurrency(c) ? value.rate || rememberedRate(c) : '' }); }}
          className="h-[52px] w-[92px] rounded-2xl border-2 border-block-2 bg-ground px-2 text-sm font-bold text-ink outline-none focus:border-money">
          <option value="INR">₹ INR</option>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {value.currency !== 'INR' && (
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${id}-r`} className="text-xs font-bold tracking-[0.06em] uppercase text-ink-2">₹ per 1 {value.currency}</label>
            <input id={`${id}-r`} inputMode="decimal" placeholder="85.50" value={value.rate} onChange={e => onChange({ ...value, rate: e.target.value })} className={inputCls} />
          </div>
          <div className="num w-[92px] pb-3.5 text-right text-sm font-bold text-ink-2" aria-live="polite">
            {resolved?.ok ? `≈ ${formatRupees(resolved.inr)}` : ''}
          </div>
        </div>
      )}
      {value.currency !== 'INR' && resolved?.ok && resolved.foreign && (
        <p className="text-xs text-ink-2">ATLER counts {formatRupees(resolved.inr)}; you'll see {formatForeign(resolved.foreign)} next to it.</p>
      )}
    </div>
  );
}
