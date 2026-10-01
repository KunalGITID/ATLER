// Date math for billing cycles. Pure functions — no DOM, no app state.

export function pad2(value) {
    return String(value).padStart(2, '0');
}

export function parseDateValue(dateLike) {
    if (dateLike instanceof Date) return new Date(dateLike.getTime());
    if (typeof dateLike === 'string') {
        const match = dateLike.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        }
    }
    return new Date(dateLike);
}

export function getLocalDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getLocalDateTimeString(date = new Date()) {
    return `${getLocalDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatDate(ds) {
    return parseDateValue(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function normalizeDateOnly(dateLike) {
    const d = parseDateValue(dateLike);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function addMonthsClamped(dateLike, months) {
    const base = normalizeDateOnly(dateLike);
    const originalDay = base.getDate();
    const next = new Date(base);
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
    return next;
}

export function addYearsClamped(dateLike, years) {
    const base = normalizeDateOnly(dateLike);
    const originalDay = base.getDate();
    const next = new Date(base);
    next.setDate(1);
    next.setFullYear(next.getFullYear() + years);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
    return next;
}

export function addBillingCycle(dateLike, cycle, step = 1) {
    if (cycle === 'Monthly') return addMonthsClamped(dateLike, step);
    if (cycle === 'Yearly') return addYearsClamped(dateLike, step);
    const days = parseInt(cycle, 10);
    const next = normalizeDateOnly(dateLike);
    next.setDate(next.getDate() + ((Number.isFinite(days) && days > 0 ? days : 30) * step));
    return next;
}

export function getMonthlyCost(sub) {
    const price = parseFloat(sub.price);
    if (sub.cycle === 'Yearly') return price / 12;
    if (sub.cycle === 'Monthly') return price;
    const days = parseInt(sub.cycle);
    if (!days || days <= 0) return price;
    return (price / days) * 30;
}

// Renewal dates are always counted from the anchor (step n = anchor + n
// cycles), never from the previous renewal — otherwise a plan started on the
// 31st gets clamped to the 28th in February and stays on the 28th forever.
export function getNextRenewalDate(dateAdded, cycle, today = new Date()) {
    const start = normalizeDateOnly(dateAdded);
    const until = normalizeDateOnly(today);
    let step = 0;
    let next = start;
    while (next <= until) {
        step += 1;
        next = addBillingCycle(start, cycle, step);
    }
    return next;
}

export function getLastRenewalDate(dateAdded, cycle, today = new Date()) {
    const start = normalizeDateOnly(dateAdded);
    const until = normalizeDateOnly(today);
    let step = 0;
    let last = start;
    let next = addBillingCycle(start, cycle, 1);
    while (next <= until) {
        step += 1;
        last = next;
        next = addBillingCycle(start, cycle, step + 1);
    }
    return last;
}

// Every renewal date from the anchor up to today. Capped so a bad cycle
// value can never spin forever.
export function getRenewalDatesUntil(anchor, cycle, until, maxCount = 1000) {
    const start = normalizeDateOnly(anchor);
    const dates = [];
    let d = start;
    while (d <= until && dates.length < maxCount) {
        dates.push(d);
        d = addBillingCycle(start, cycle, dates.length);
    }
    return dates;
}

export function isWithinRange(dateString, range, now = new Date()) {
    const date = normalizeDateOnly(dateString);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (range === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (range === '30d') {
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 29);
        return date >= cutoff && date <= now;
    }
    if (range === 'year') {
        return date.getFullYear() === now.getFullYear();
    }
    return true;
}

export function formatCycle(cycle) {
    if (cycle === 'Monthly' || cycle === 'Yearly') return cycle;
    return `Every ${cycle} days`;
}

export function todayISO() { return getLocalDateKey(new Date()); }

// Renewals that should become expenses: on or after the day the subscription
// was added (no backfilling history before the user tracked it) and after the
// last one already logged.
export function getUnloggedRenewals(sub, today = new Date()) {
    const anchor = sub.startDate || sub.dateAdded;
    const added = normalizeDateOnly(sub.dateAdded);
    const lastLogged = sub.lastLoggedRenewal ? normalizeDateOnly(sub.lastLoggedRenewal) : null;
    return getRenewalDatesUntil(anchor, sub.cycle, normalizeDateOnly(today))
        .filter(d => d >= added && (!lastLogged || d > lastLogged));
}
