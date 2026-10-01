// The ATLER data model. Everything the app stores is one of these.
import type { Cycle, Day } from './dates.ts';
import type { Paise } from './money.ts';

export type PlanStatus = 'trial' | 'active' | 'paused' | 'cancelled';
export type Remind = 'off' | '3d' | '1d' | 'both';

export interface Plan {
  id: string;
  name: string;
  price: Paise;
  cycle: Cycle;
  anchor: Day;            // first billing date; every later one is counted from it
  categoryId: string | null;
  status: PlanStatus;
  trialEnds: Day | null;  // set while status = 'trial'
  remind: Remind;
  createdOn: Day;
}

// Plan renewals are not stored; they're computed (core/renewals.ts).
export type PaymentSource = 'manual' | 'sms' | 'statement';

export interface Payment {
  id: string;
  name: string;
  amount: Paise;
  on: Day;
  categoryId: string | null;
  source: PaymentSource;
}

export interface Category {
  id: string;
  name: string;
  budget: Paise | null;   // per month
}

// Plan history (price changes, pauses, cancellations) is a list of events, so
// "what did this cost me" and "what have I saved" are always computed, never stored twice.
export type PlanEvent =
  | { id: string; planId: string; on: Day; kind: 'price'; from: Paise; to: Paise }
  | { id: string; planId: string; on: Day; kind: 'paused' | 'resumed' | 'cancelled' | 'restarted' };
