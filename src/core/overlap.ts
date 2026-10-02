// Paying twice for the same thing: plans that do the same job, plans whose
// bundle already includes another, the same expense logged twice, and plans
// you may have stopped using. Each returns nothing when there's nothing real.
import { addDays, daysBetween, monthlyCost, type Day } from './dates.ts';
import { sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';
import { planKind, planPrice } from './share.ts';

const SERVICES: Array<{ group: string; re: RegExp }> = [
  { group: 'video streaming', re: /netflix|prime ?video|amazon ?prime|hotstar|jiocinema|sony ?liv|zee5|apple ?tv|mubi|aha\b|sun ?nxt|alt ?balaji|discovery\+|lionsgate/i },
  { group: 'music', re: /spotify|youtube ?music|apple ?music|jiosaavn|saavn|gaana|wynk|amazon ?music/i },
  { group: 'cloud storage', re: /google ?one|icloud|dropbox|onedrive|microsoft ?365|office ?365|mega\b|pcloud/i },
  { group: 'AI assistants', re: /chatgpt|openai|claude|gemini|perplexity|copilot|grok/i },
  { group: 'food delivery memberships', re: /swiggy ?one|zomato ?(gold|pro)|eatsure/i },
  { group: 'fitness', re: /cult\.?fit|cultfit|healthify|fittr|gym|strava/i },
];

// A bundle that already includes something you also pay for separately.
const BUNDLES: Array<{ bundle: RegExp; includes: RegExp; note: string }> = [
  { bundle: /youtube ?premium/i, includes: /youtube ?music|spotify|apple ?music|jiosaavn|gaana|wynk/i, note: 'YouTube Premium already includes YouTube Music.' },
  { bundle: /amazon ?prime/i, includes: /prime ?video|amazon ?music/i, note: 'Amazon Prime already includes Prime Video and Amazon Music.' },
  { bundle: /microsoft ?365|office ?365/i, includes: /onedrive/i, note: 'Microsoft 365 already includes 1 TB of OneDrive.' },
  { bundle: /google ?one/i, includes: /gemini/i, note: 'Some Google One plans already include Gemini.' },
];

export interface Overlap { group: string; plans: Plan[]; perMonth: Paise; note: string }

const billing = (p: Plan) => p.status === 'active' || p.status === 'trial';
const perMonth = (plans: readonly Plan[]) => sum(plans.map(p => monthlyCost(planPrice(p), p.cycle)));

export function overlaps(plans: readonly Plan[]): Overlap[] {
  const live = plans.filter(billing);
  const out: Overlap[] = [];
  const used = new Set<string>();
  for (const b of BUNDLES) {
    const bundle = live.find(p => b.bundle.test(p.name));
    const extra = live.filter(p => p !== bundle && b.includes.test(p.name) && !b.bundle.test(p.name));
    if (bundle && extra.length) {
      const pair = [bundle, ...extra];
      pair.forEach(p => used.add(p.id));
      out.push({ group: 'bundle', plans: pair, perMonth: perMonth(extra), note: b.note });
    }
  }
  for (const s of SERVICES) {
    const same = live.filter(p => s.re.test(p.name));
    if (same.length < 2 || same.every(p => used.has(p.id))) continue;
    out.push({ group: s.group, plans: same, perMonth: perMonth(same), note: `You pay for ${same.length} ${s.group} plans.` });
  }
  return out.sort((a, b) => b.perMonth - a.perMonth);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// The same expense twice: same name, amount and day (an SMS pasted and a
// statement imported, say). Pairs, newest first, from the last `days` days.
export function duplicatePayments(payments: readonly Payment[], today: Day, days = 60): Array<[Payment, Payment]> {
  const seen = new Map<string, Payment>();
  const pairs: Array<[Payment, Payment]> = [];
  const recent = payments.filter(p => daysBetween(p.on, today) >= 0 && daysBetween(p.on, today) <= days)
    .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : a.id < b.id ? -1 : 1));
  for (const p of recent) {
    const k = `${norm(p.name)}|${p.amount}|${p.on}`;
    const first = seen.get(k);
    if (first) pairs.push([first, p]);
    else seen.set(k, p);
  }
  return pairs;
}

// ---------- still using it? ----------

const QUIET_DAYS = 180;      // ask about plans untouched this long
const MIN_PER_MONTH = 9900;  // ₹99/month: below that, not worth a nudge

export interface StillUsing { plan: Plan; perMonth: Paise; lastSixMonths: Paise }

// Subscriptions you've had for 6+ months without touching them (no edit,
// pause, price change or "yes, I use it") — easy to forget and keep paying.
export function stillUsing(plans: readonly Plan[], events: readonly PlanEvent[], today: Day): StillUsing[] {
  const since = addDays(today, -QUIET_DAYS);
  return plans
    .filter(p => p.status === 'active' && planKind(p) === 'subscription' && p.createdOn <= since)
    .filter(p => !events.some(e => e.planId === p.id && e.on > since))
    .map(plan => ({
      plan,
      perMonth: monthlyCost(planPrice(plan), plan.cycle),
      lastSixMonths: sum(renewalsBetween(plan, events.filter(e => e.planId === plan.id), since, today).map(r => r.amount)),
    }))
    .filter(x => x.perMonth >= MIN_PER_MONTH)
    .sort((a, b) => b.perMonth - a.perMonth);
}
