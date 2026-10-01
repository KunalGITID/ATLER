// Which renewal reminders are due on a given day, and what they say. Shared
// by the app (fallback when Web Push isn't available) and the send-reminders
// Edge Function (see scripts/gen-edge-shared.mjs).
import { getLocalDateKey, getNextRenewalDate, normalizeDateOnly } from './dates.js';

export const REMINDER_DAYS = { none: [], '3days': [3], '1day': [1], both: [3, 1] };
// Trials always warn 3 days and 1 day before the first charge, whatever the
// plan's renewal reminder is set to: missing that one costs real money.
export const TRIAL_REMINDER_DAYS = [3, 1];

// True while the trial hasn't converted yet (its end is after `today`).
export function isInTrial(sub, today = new Date()) {
    return Boolean(sub.trialEnds) && normalizeDateOnly(sub.trialEnds) > normalizeDateOnly(today);
}

function wholeDaysBetween(from, to) {
    const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((utc(to) - utc(from)) / 86400000);
}

// `today` is the user's local calendar day. Returns one entry per reminder
// that should go out today.
export function dueReminders(subs, today) {
    const day = normalizeDateOnly(today);
    const due = [];
    for (const sub of subs) {
        if (sub.paused) continue;
        if (isInTrial(sub, day)) {
            const daysBefore = wholeDaysBetween(day, normalizeDateOnly(sub.trialEnds));
            if (TRIAL_REMINDER_DAYS.includes(daysBefore)) {
                due.push({ sub, renewalDate: getLocalDateKey(normalizeDateOnly(sub.trialEnds)), daysBefore, trial: true });
            }
            continue;
        }
        const days = REMINDER_DAYS[sub.reminder] || [];
        if (!days.length) continue;
        const next = getNextRenewalDate(sub.startDate || sub.dateAdded, sub.cycle, day);
        const daysBefore = wholeDaysBetween(day, next);
        if (days.includes(daysBefore)) {
            due.push({ sub, renewalDate: getLocalDateKey(next), daysBefore });
        }
    }
    return due;
}

export function reminderMessage({ sub, renewalDate, daysBefore, trial = false }) {
    const amount = parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const when = daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;
    const on = normalizeDateOnly(renewalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (trial) {
        const per = sub.cycle === 'Monthly' ? '/month' : sub.cycle === 'Yearly' ? '/year' : ` every ${sub.cycle} days`;
        return {
            title: `${sub.name} trial ends ${when}`,
            body: `Then ₹${amount}${per} from ${on}. Cancel before then if you don't want it.`,
            tag: `trial-${sub.id}-${renewalDate}-${daysBefore}`,
        };
    }
    return {
        title: `${sub.name} renews ${when}`,
        body: `₹${amount} on ${on}`,
        tag: `renewal-${sub.id}-${renewalDate}-${daysBefore}`,
    };
}
