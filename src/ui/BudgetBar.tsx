import { formatRupees, paise } from '../core/money.ts';
import type { BudgetLine } from '../core/budgets.ts';

// lime = spent so far this month, coral = renewals still coming, track = left.
export function BudgetBar({ line }: { line: BudgetLine }) {
  const total = Math.max(line.budget, line.spent + line.coming);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const label = `${line.category.name}: ${formatRupees(line.spent)} spent and ${formatRupees(line.coming)} still coming of ${formatRupees(line.budget)}. ${line.over ? `Over by ${formatRupees(paise(-line.left))}` : `${formatRupees(line.left)} left`}.`;
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-[15px] font-bold">{line.category.name}</div>
        <div className={`num shrink-0 text-sm font-bold ${line.over ? 'text-danger' : ''}`}>
          {line.over ? `Over by ${formatRupees(paise(-line.left))}` : `${formatRupees(line.left)} left`}
        </div>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-block-2" role="img" aria-label={label}>
        <div className="h-full bg-money" style={{ width: pct(line.spent) }} />
        <div className="h-full bg-soon" style={{ width: pct(line.coming) }} />
      </div>
      <div className="mt-1.5 text-xs text-ink-2">{formatRupees(line.spent)} spent · {formatRupees(line.coming)} coming · of {formatRupees(line.budget)}</div>
      {/* Where it's heading at your usual pace: a warning before it's over, not after. */}
      {(line.risk === 'likely' || line.risk === 'close') && (
        <div className="mt-1 text-xs font-bold text-soon">
          {line.risk === 'likely' ? `Heading for ${formatRupees(line.projected)} at your usual pace` : `Heading for ${formatRupees(line.projected)}, close to the limit`}
        </div>
      )}
    </div>
  );
}
