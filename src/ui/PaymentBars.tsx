import { formatRupees, type Paise } from '../core/money.ts';
import type { Renewal } from '../core/renewals.ts';

// One bar per payment; height = amount, so a price rise shows as a step.
// Lime = paid at today's price, grey = an older price.
export function PaymentBars({ history, current }: { history: Renewal[]; current: Paise }) {
  const shown = history.slice(-12);
  const max = Math.max(...shown.map(r => r.amount), 1);
  const older = shown.find(r => r.amount !== current);
  return (
    <figure className="m-0">
      <div className="flex h-16 items-end gap-1.5" role="img" aria-label={`Last ${shown.length} payments: ${shown.map(r => formatRupees(r.amount)).join(', ')}`}>
        {shown.map(r => (
          <div
            key={r.on}
            className={`max-w-6 flex-1 rounded-md ${r.amount === current ? 'bg-money' : 'bg-block-2'}`}
            style={{ height: `${Math.max(12, (r.amount / max) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-2 text-xs font-bold text-ink-2">
        One bar per payment{older ? ` · grey ${formatRupees(older.amount)}, lime ${formatRupees(current)}` : ''}
      </figcaption>
    </figure>
  );
}
