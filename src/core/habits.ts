// Patterns in how you spend, from your own logged expenses. Each habit only
// shows when the data clearly says it, so the cards never state the obvious.
import { addDays, dayOfMonth, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { formatRupees, sum, type Paise } from './money.ts';
import type { Category, Payment } from './model.ts';
import { knownMerchant } from './import/statement.ts';
import { ownAmount } from './share.ts';

export interface Habit { id: string; title: string; body: string }

const MIN_PAYMENTS = 15;
const weekday = (d: Day) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function habits(payments: readonly Payment[], categories: readonly Category[], today: Day): Habit[] {
  const recent = payments.filter(p => p.on > addDays(today, -90) && p.on <= today);
  if (recent.length < MIN_PAYMENTS) return [];
  const total = sum(recent.map(ownAmount));
  if (total <= 0) return [];
  const out: Habit[] = [];

  // Weekends are 2 days in 7 (29%); flag when they take much more than that.
  const weekend = sum(recent.filter(p => [0, 6].includes(weekday(p.on))).map(ownAmount));
  if (weekend / total >= 0.45) {
    out.push({ id: 'weekend', title: `${pct(weekend / total)} on weekends`, body: `Saturdays and Sundays take ${formatRupees(weekend)} of your last 90 days' ${formatRupees(total)}.` });
  }

  // One merchant you keep going back to.
  const last30 = recent.filter(p => p.on > addDays(today, -30));
  const byMerchant = new Map<string, { amount: number; count: number }>();
  for (const p of last30) {
    const m = knownMerchant(p.name);
    if (!m) continue;
    const e = byMerchant.get(m) ?? { amount: 0, count: 0 };
    e.amount += ownAmount(p);
    e.count++;
    byMerchant.set(m, e);
  }
  const top = [...byMerchant].sort((a, b) => b[1].amount - a[1].amount)[0];
  const last30Total = sum(last30.map(ownAmount));
  if (top && top[1].count >= 4 && last30Total > 0 && top[1].amount / last30Total >= 0.15) {
    out.push({ id: 'merchant', title: `${top[0]}: ${top[1].count} times in 30 days`, body: `${formatRupees(top[1].amount as Paise)}, ${pct(top[1].amount / last30Total)} of your everyday spending this month and the last.` });
  }

  // Front-loaded months: the first week takes a big share (salary week).
  const months = [1, 2, 3].map(i => startOfMonth(addDays(startOfMonth(today), -28 * i)));
  const shares = months.map(m => {
    const all = sum(payments.filter(p => p.on >= m && p.on <= endOfMonth(m)).map(ownAmount));
    const week = sum(payments.filter(p => p.on >= m && dayOfMonth(p.on) <= 7 && p.on <= endOfMonth(m)).map(ownAmount));
    return all > 0 ? week / all : null;
  }).filter((x): x is number => x !== null);
  if (shares.length >= 2) {
    const avg = shares.reduce((a, b) => a + b, 0) / shares.length;
    if (avg >= 0.4) out.push({ id: 'first-week', title: `${pct(avg)} in the first week`, body: 'Most of each month goes in its first 7 days. Spreading big buys out makes the month easier to read.' });
  }

  // A category running well above its usual pace this month.
  const first = startOfMonth(today);
  const elapsed = dayOfMonth(today);
  if (elapsed >= 7) {
    for (const c of categories) {
      const now = sum(payments.filter(p => p.categoryId === c.id && p.on >= first && p.on <= today).map(ownAmount));
      const before = payments.filter(p => p.categoryId === c.id && p.on >= addDays(first, -90) && p.on < first);
      if (before.length < 3) continue;
      const usualPerDay = sum(before.map(ownAmount)) / 90;
      const expected = usualPerDay * elapsed;
      if (now - expected >= 100000 && now >= 1.3 * expected) {
        out.push({ id: `pace-${c.id}`, title: `${c.name} is running ${pct(now / expected - 1)} above usual`, body: `${formatRupees(now)} so far this month; by now you'd usually be near ${formatRupees(Math.round(expected) as Paise)}.` });
      }
    }
  }
  return out;
}
