import type { Cycle } from '../core/dates.ts';

// The billing options people pick from.
export const CYCLES: Record<string, { label: string; cycle: Cycle }> = {
  monthly: { label: 'Monthly', cycle: { unit: 'month', every: 1 } },
  yearly: { label: 'Yearly', cycle: { unit: 'year', every: 1 } },
  quarterly: { label: 'Every 3 months', cycle: { unit: 'month', every: 3 } },
  d28: { label: 'Every 28 days (prepaid mobile)', cycle: { unit: 'day', every: 28 } },
  weekly: { label: 'Weekly', cycle: { unit: 'day', every: 7 } },
};

export const cycleKey = (c: Cycle) =>
  Object.entries(CYCLES).find(([, o]) => o.cycle.unit === c.unit && o.cycle.every === c.every)?.[0] ?? 'monthly';
