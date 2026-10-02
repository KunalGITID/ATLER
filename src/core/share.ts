// Your part of the money. A plan split four ways costs you a quarter; an
// expense where friends owe you back costs you what's left. Every total in
// ATLER counts your part; the full amount is shown where it was billed.
// Also reads the plan fields older rows don't have, with their defaults.
import { paise, sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanKind } from './model.ts';

export const planKind = (p: Plan): PlanKind => p.kind ?? 'subscription';
export const isAutopay = (p: Plan): boolean => p.autopay ?? true;
export const sharedBy = (p: Plan): number => Math.max(1, Math.floor(p.sharedBy ?? 1));

// A plan price (full, as billed) -> your share of it.
export const yourShare = (p: Plan, price: Paise): Paise => paise(Math.round(price / sharedBy(p)));
// Your share of the plan's current price.
export const planPrice = (p: Plan): Paise => yourShare(p, p.price);

// What others still owe you on an expense, and what it costs you.
export const owed = (p: Payment): Paise => sum((p.split ?? []).filter(s => !s.settled).map(s => s.amount));
export const othersPart = (p: Payment): Paise => sum((p.split ?? []).map(s => s.amount));
export const ownAmount = (p: Payment): Paise => paise(Math.max(0, p.amount - othersPart(p)));
