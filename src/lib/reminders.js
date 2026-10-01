// Which renewal reminders are due on a given day, and what they say. Shared
// by the app (fallback when Web Push isn't available) and the send-reminders
// Edge Function (see scripts/gen-edge-shared.mjs).
import { getLocalDateKey, getNextRenewalDate, normalizeDateOnly } from './dates.js';

export const REMINDER_DAYS = { none: [], '3days': [3], '1day': [1], both: [3, 1] };

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

export function reminderMessage({ sub, renewalDate, daysBefore }) {
    const amount = parseFloat(sub.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const when = daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;
    const on = normalizeDateOnly(renewalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return {
        title: `${sub.name} renews ${when}`,
        body: `₹${amount} on ${on}`,
        tag: `renewal-${sub.id}-${renewalDate}-${daysBefore}`,
    };
}
