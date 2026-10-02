// Asking whether an unusual spend was expected: on the Month card, right
// after you add one, and in a one-off review of past jumps. Every answer
// tunes what ATLER calls unusual for you (core/alertFeedback.ts).
import { useState } from 'react';
import type { Unusual } from '../core/insights.ts';
import { formatRupees } from '../core/money.ts';
import type { AtlerDB } from '../data/db.ts';
import { answerAlert, unanswer } from '../data/verdicts.ts';
import { Sheet } from '../ui/Sheet.tsx';
import { useToast } from '../ui/Toast.tsx';

const btn = 'h-10 rounded-control bg-block-2 text-sm font-bold text-ink';

export const howUnusual = (u: Unusual) => `${u.times.toFixed(1)}× your usual spend at ${u.payment.name} of ${formatRupees(u.median)}`;

export function AnswerButtons({ db, unusual, after }: { db: AtlerDB; unusual: Unusual; after?: () => void }) {
  const toast = useToast();
  const answer = (expected: boolean) => {
    void answerAlert(db, unusual, expected);
    toast({
      text: expected ? `Got it. ATLER will flag fewer like this at ${unusual.payment.name}.` : 'Noted. ATLER will keep flagging jumps like this.',
      action: { label: 'Undo', run: () => void unanswer(db, unusual.payment.id) },
    });
    after?.();
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" className={btn} onClick={() => answer(true)}>Expected</button>
      <button type="button" className={btn} onClick={() => answer(false)}>Not expected</button>
    </div>
  );
}

// Right after you add an expense that's unusual: ask while you remember.
export function AskSheet({ db, unusual, onClose }: { db: AtlerDB; unusual: Unusual | null; onClose: () => void }) {
  return (
    <Sheet open={!!unusual} onClose={onClose} title="Was this expected?">
      {unusual && (
        <div className="flex flex-col gap-1 pb-2">
          <div className="font-display text-2xl leading-tight font-bold">{unusual.payment.name} · {formatRupees(unusual.payment.amount)}</div>
          <div className="text-[13px] font-bold text-ink-2">{howUnusual(unusual)}</div>
          <AnswerButtons db={db} unusual={unusual} after={onClose} />
          <button type="button" className="mt-1 h-10 text-sm font-bold text-ink-2" onClick={onClose}>Ask me later</button>
        </div>
      )}
    </Sheet>
  );
}

// A one-off review of your biggest past jumps, so ATLER learns from day one.
export function ReviewSheet({ db, jumps, open, onClose }: { db: AtlerDB; jumps: Unusual[]; open: boolean; onClose: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const left = jumps.filter(u => !done.has(u.payment.id));
  return (
    <Sheet open={open} onClose={onClose} title="Were these expected?">
      <p className="text-sm text-ink-2">Your biggest jumps so far. A few answers and ATLER stops flagging what’s normal for you.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {left.map(u => (
          <li key={u.payment.id} className="rounded-tile bg-block p-3">
            <div className="font-bold">{u.payment.name} · {formatRupees(u.payment.amount)} <span className="font-normal text-ink-2">· {u.payment.on}</span></div>
            <div className="text-[13px] text-ink-2">{howUnusual(u)}</div>
            <AnswerButtons db={db} unusual={u} after={() => setDone(d => new Set(d).add(u.payment.id))} />
          </li>
        ))}
      </ul>
      {!left.length && <p className="py-4 text-center font-bold">All done. Thanks!</p>}
      <button type="button" className="mt-2 h-11 w-full text-sm font-bold text-ink-2" onClick={onClose}>{left.length ? 'Later' : 'Close'}</button>
    </Sheet>
  );
}
