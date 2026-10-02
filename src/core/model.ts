// The ATLER data model. Everything the app stores is one of these.
import type { Cycle, Day } from './dates.ts';
import type { Paise } from './money.ts';

export type PlanStatus = 'trial' | 'active' | 'paused' | 'cancelled';
export type Remind = 'off' | '3d' | '1d' | 'both';
// What a recurring charge is. Subscriptions charge themselves; bills, rent,
// EMIs and the like often have to be paid by hand (autopay = false).
export type PlanKind = 'subscription' | 'bill' | 'rent' | 'emi' | 'sip' | 'insurance';
export const PLAN_KINDS: Record<PlanKind, string> = {
  subscription: 'Subscription', bill: 'Bill', rent: 'Rent', emi: 'EMI / loan', sip: 'SIP / investment', insurance: 'Insurance',
};

// A price in another currency, in its minor units (cents): $20 = 2000. The
// rupee amount next to it is what ATLER counts; this is what you see billed.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];
export interface Foreign { currency: Currency; amount: number }

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
  // Added later; missing on older rows (read them through core/share.ts).
  kind?: PlanKind;          // default 'subscription'
  autopay?: boolean;        // default true; false = mark each charge paid
  endsOn?: Day | null;      // last charge on or before this day (an EMI's end)
  sharedBy?: number;        // people splitting it, you included; default 1
  foreign?: Foreign | null; // billed in another currency
}

// Plan renewals are not stored; they're computed (core/renewals.ts).
export type PaymentSource = 'manual' | 'sms' | 'statement' | 'receipt' | 'import';

// Part of an expense someone else owes you back.
export interface Split { who: string; amount: Paise; settled: boolean }

export interface Payment {
  id: string;
  name: string;
  amount: Paise;
  on: Day;
  categoryId: string | null;
  source: PaymentSource;
  note?: string;
  tags?: string[];
  split?: Split[];          // what others owe you of `amount`
  foreign?: Foreign | null;
}

// Money coming in. 'monthly' repeats on the same day every month from `on`.
export interface Income {
  id: string;
  name: string;
  amount: Paise;
  on: Day;
  repeat: 'none' | 'monthly';
}

// Something you're saving up for.
export interface Goal {
  id: string;
  name: string;
  target: Paise;
  saved: Paise;
  by: Day | null;
}

export interface Category {
  id: string;
  name: string;
  budget: Paise | null;   // per month
}

// Plan history (price changes, pauses, cancellations) is a list of events, so
// "what did this cost me" and "what have I saved" are always computed, never stored twice.
// `on` is the calendar day it applies from; `at` is when it was recorded
// (ms), which orders several changes made on the same day.
export type PlanEvent =
  | { id: string; planId: string; on: Day; at: number; kind: 'price'; from: Paise; to: Paise }
  | { id: string; planId: string; on: Day; at: number; kind: 'paused' | 'resumed' | 'cancelled' | 'restarted' }
  // paid: a charge that isn't automatic was paid (`on` = its due day).
  // reviewed: you said you still use it (quiets "still using it?" for a while).
  | { id: string; planId: string; on: Day; at: number; kind: 'paid' | 'reviewed' };

export const byWhen = (a: PlanEvent, b: PlanEvent) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.at - b.at);
