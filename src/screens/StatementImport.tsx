import { useRef, useState, type FormEvent } from 'react';
import { describeCycle, today as todayDay } from '../core/dates.ts';
import type { Found } from '../core/import/recurring.ts';
import { readStatement } from '../core/import/statement.ts';
import { suggestCategory } from '../core/import/sms.ts';
import { formatRupees } from '../core/money.ts';
import type { Category, Plan } from '../core/model.ts';
import { addPlan } from '../data/actions.ts';
import { editPlan } from '../data/planActions.ts';
import type { AtlerDB } from '../data/db.ts';
import { PdfPasswordError, pdfToCsv } from '../data/pdf.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function StatementImport({ db, plans, categories }: { db: AtlerDB; plans: Plan[]; categories: Category[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState<{ file: File; wrong: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [found, setFound] = useState<{ items: Found[]; debits: number } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  async function read(file: File, pw?: string) {
    setMessage(isPdf(file) ? 'Reading the PDF…' : null);
    try {
      const text = isPdf(file) ? await pdfToCsv(file, pw) : await file.text();
      const debits = readStatement(text);
      // The subscription model loads only when someone imports a statement.
      const { findRecurring } = await import('../core/import/recurring.ts');
      const items = findRecurring(debits, todayDay(), plans.map(p => ({ id: p.id, name: p.name, price: p.price })));
      setLocked(null);
      setPassword('');
      setMessage(null);
      setFound({ items, debits: debits.length });
      setPicked(new Set(items.flatMap((f, i) => (f.active && !f.alreadyTracked && f.confidence >= 50 ? [i] : []))));
    } catch (err) {
      if (err instanceof PdfPasswordError) { setMessage(null); setLocked({ file, wrong: err.wrong }); return; }
      setMessage((err as Error).message);
    }
  }

  async function add() {
    if (!found) return;
    const byName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const today = todayDay();
    for (const i of picked) {
      const f = found.items[i]!;
      const hint = suggestCategory(f.name);
      await addPlan(db, { name: f.name, price: f.price, cycle: f.cycle, lastCharged: f.lastCharged, today, categoryId: hint ? byName.get(hint.toLowerCase()) ?? null : null });
    }
    setMessage(`${picked.size} plan${picked.size === 1 ? '' : 's'} added.`);
    setFound(null);
  }

  return (
    <Block className="flex flex-col gap-2.5 !p-4">
      <Kicker className="text-ink-2">Find subscriptions</Kicker>
      <p className="text-sm text-ink-2">Pick your bank statement (CSV or PDF). ATLER spots the charges that repeat. It's read on this phone and never uploaded.</p>
      <Button kind="plain" onClick={() => input.current?.click()}>Choose a statement</Button>
      <input ref={input} type="file" accept=".csv,text/csv,.pdf,application/pdf" hidden aria-label="Bank statement file"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f); }} />
      {message && <p role="status" className="text-sm font-bold">{message}</p>}

      <Sheet open={locked !== null} onClose={() => setLocked(null)} title="Password needed">
        <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (locked && password) void read(locked.file, password); }}>
          <h2 className="font-display text-2xl font-bold">Password needed</h2>
          <p className="text-sm text-ink-2">{locked?.wrong ? 'That password is not right. ' : ''}Banks usually use your date of birth or customer ID; the email the statement came with says which.</p>
          <input type="password" aria-label="PDF password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
            className="h-[52px] rounded-2xl border-2 border-block-2 bg-ground px-4 text-base font-semibold text-ink outline-none focus:border-money" />
          <Button kind="primary" type="submit">OPEN</Button>
        </form>
      </Sheet>

      <Sheet open={found !== null} onClose={() => setFound(null)} title="Found in your statement">
        <div className="flex max-h-[80vh] flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Found in your statement</h2>
          <p className="text-sm text-ink-2">
            {found?.items.length
              ? `${found.items.length} repeating charge${found.items.length > 1 ? 's' : ''} in ${found.debits} payments. Untick anything that isn't a subscription.`
              : `No repeating charges in ${found?.debits ?? 0} payments. A statement covering 3 months or more works best.`}
          </p>
          <ul className="flex flex-col overflow-y-auto rounded-tile bg-block">
            {found?.items.map((f, i) => (
              <li key={`${f.name}-${f.price}`} className={i ? 'border-t-2 border-ground' : ''}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
                  <input type="checkbox" className="mt-1 size-5 accent-[var(--color-money)]" checked={picked.has(i)}
                    onChange={() => setPicked(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold">{f.name}
                      {!f.active && <span className="ml-2 rounded-md bg-block-2 px-1.5 py-0.5 text-[11px] text-ink-2">No recent charge</span>}
                      {f.alreadyTracked && <span className="ml-2 rounded-md bg-block-2 px-1.5 py-0.5 text-[11px] text-ink-2">Already tracked</span>}
                    </span>
                    <span className="block text-xs text-ink-2">{formatRupees(f.price)} · {describeCycle(f.cycle)} · last {fmtDay(f.lastCharged)} · seen {f.charges}×</span>
                    {f.priceChange && <span className="block text-xs font-bold text-soon">Price went from {formatRupees(f.priceChange.from)} to {formatRupees(f.priceChange.to)} on {fmtDay(f.priceChange.on)}</span>}
                  </span>
                </label>
                {f.tracked && (
                  <div className="-mt-1 flex items-center justify-between gap-3 px-4 pb-3 pl-12 text-xs">
                    <span className="font-bold text-soon">You track it at {formatRupees(f.tracked.price)}; the bank now charges {formatRupees(f.price)}.</span>
                    <button type="button" className="h-8 shrink-0 rounded-control bg-block-2 px-3 font-extrabold" onClick={async () => {
                      const plan = plans.find(p => p.id === f.tracked!.id);
                      if (plan) await editPlan(db, plan, { name: plan.name, price: f.price, cycle: plan.cycle }, f.priceChange?.on && f.priceChange.on <= todayDay() ? f.priceChange.on : todayDay());
                      setFound(cur => cur && { ...cur, items: cur.items.map(x => (x === f ? { ...x, tracked: null } : x)) });
                    }}>Update price</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Button kind="primary" disabled={!picked.size} onClick={add}>{picked.size ? `ADD ${picked.size}` : 'TICK SOME TO ADD'}</Button>
        </div>
      </Sheet>
    </Block>
  );
}
