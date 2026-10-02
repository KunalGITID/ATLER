import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan, PlanEvent } from './model.ts';
import { dueReminders, inTrial, reminderText } from './reminders.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (o: Partial<Plan>): Plan => ({
  id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-19'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'both', createdOn: d('2026-01-01'), ...o,
});
const when = (today: string, p: Plan, events: PlanEvent[] = []) => dueReminders([p], events, d(today)).map(r => [r.on, r.daysBefore, r.trial]);

describe('dueReminders', () => {
  it('3 days and 1 day before, as chosen', () => {
    expect(when('2026-10-16', plan({}))).toEqual([['2026-10-19', 3, false]]);
    expect(when('2026-10-18', plan({}))).toEqual([['2026-10-19', 1, false]]);
    expect(when('2026-10-17', plan({}))).toEqual([]);
    expect(when('2026-10-16', plan({ remind: '1d' }))).toEqual([]);
    expect(when('2026-10-18', plan({ remind: 'off' }))).toEqual([]);
  });

  it('nothing for paused or cancelled plans', () => {
    const paused: PlanEvent[] = [{ id: 'e', planId: 'n', on: d('2026-10-01'), at: 1, kind: 'paused' }];
    expect(when('2026-10-18', plan({ status: 'paused' }), paused)).toEqual([]);
  });

  it('a trial always warns before it converts, even with reminders off', () => {
    const trial = plan({ status: 'trial', remind: 'off', anchor: d('2026-10-01'), trialEnds: d('2026-10-25') });
    expect(inTrial(trial, d('2026-10-20'))).toBe(true);
    expect(when('2026-10-22', trial)).toEqual([['2026-10-25', 3, true]]);
    expect(when('2026-10-24', trial)).toEqual([['2026-10-25', 1, true]]);
    // after converting it follows its own setting (off)
    expect(inTrial(trial, d('2026-10-25'))).toBe(false);
    expect(when('2026-11-24', trial)).toEqual([]);
  });
});

describe('reminderText', () => {
  it('says what, when and how much', () => {
    const [r] = dueReminders([plan({})], [], d('2026-10-18'));
    expect(reminderText(r!)).toEqual({ title: 'Netflix renews tomorrow', body: '₹199 on 19 Oct.', tag: 'renewal-n-2026-10-19-1' });
    const [t] = dueReminders([plan({ status: 'trial', trialEnds: d('2026-10-25') })], [], d('2026-10-22'));
    expect(reminderText(t!).title).toBe('Netflix trial ends in 3 days');
    expect(reminderText(t!).body).toBe("Then ₹199 from 25 Oct. Cancel before then if you don't want it.");
  });
});
