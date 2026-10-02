// Questions about your money, answered on the phone from your own data. No
// AI service: a handful of question shapes ("how much did I spend on Swiggy
// last month?", "what if I cancel Netflix?") matched with plain patterns,
// answered with the same maths as the rest of the app.
import { addDays, endOfMonth, makeDay, monthlyCost, startOfMonth, type Day } from './dates.ts';
import { formatRupees, paise, sum, type Paise } from './money.ts';
import type { Category, Income, Payment, Plan, PlanEvent } from './model.ts';
import { incomeBetween, owedByPerson } from './money-in.ts';
import { plansSummary } from './plans.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount, planPrice } from './share.ts';
import { knownMerchant } from './import/statement.ts';

export interface AskData { plans: Plan[]; events: PlanEvent[]; payments: Payment[]; categories: Category[]; incomes: Income[] }
export interface Answer { text: string; lines?: Array<{ label: string; value: string }> }
export interface Period { from: Day; to: Day; label: string }

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthLabel = (d: Day) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

// The time a question is about, and the words that said it (removed before
// looking for what it's about). This month when it doesn't say.
export function periodOf(q: string, today: Day): Period & { said: string } {
  const year = Number(today.slice(0, 4));
  const thisMonth = startOfMonth(today);
  const tests: Array<[RegExp, (m: RegExpMatchArray) => Period]> = [
    [/\btoday\b/, () => ({ from: today, to: today, label: 'today' })],
    [/\byesterday\b/, () => ({ from: addDays(today, -1), to: addDays(today, -1), label: 'yesterday' })],
    [/\bthis week\b/, () => { const wd = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; return { from: addDays(today, -wd), to: today, label: 'this week' }; }],
    [/\blast week\b/, () => { const wd = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; const mon = addDays(today, -wd - 7); return { from: mon, to: addDays(mon, 6), label: 'last week' }; }],
    [/\b(?:in the )?last (\d{1,3}) days?\b/, m => ({ from: addDays(today, -Number(m[1]) + 1), to: today, label: `in the last ${m[1]} days` })],
    [/\b(?:in the )?last (\d{1,2}) months?\b/, m => { const n = Number(m[1]); let s = thisMonth; for (let i = 0; i < n; i++) s = startOfMonth(addDays(s, -1)); return { from: s, to: addDays(thisMonth, -1), label: `in the last ${n} months` }; }],
    [/\blast month\b/, () => { const s = startOfMonth(addDays(thisMonth, -1)); return { from: s, to: endOfMonth(s), label: `in ${monthLabel(s)}` }; }],
    [/\bthis year\b|\bso far this year\b/, () => ({ from: makeDay(year, 1, 1)!, to: today, label: 'this year' })],
    [/\blast year\b/, () => ({ from: makeDay(year - 1, 1, 1)!, to: makeDay(year - 1, 12, 31)!, label: `in ${year - 1}` })],
    [new RegExp(`\\b(?:in )?(${MONTHS.join('|')}|${MONTHS.map(m => m.slice(0, 3)).join('|')})\\b(?:,? (\\d{4}))?`), m => {
      const idx = MONTHS.findIndex(x => x.startsWith(m[1]!)) + 1;
      let y = m[2] ? Number(m[2]) : year;
      if (!m[2] && makeDay(y, idx, 1)! > today) y--; // "in December" asked in October: last December
      const s = makeDay(y, idx, 1)!;
      return { from: s, to: endOfMonth(s), label: `in ${monthLabel(s)}` };
    }],
    [/\bin (\d{4})\b/, m => ({ from: makeDay(Number(m[1]), 1, 1)!, to: makeDay(Number(m[1]), 12, 31)!, label: `in ${m[1]}` })],
    [/\bthis month\b/, () => ({ from: thisMonth, to: today, label: 'this month' })],
  ];
  for (const [re, make] of tests) {
    const m = q.match(re);
    if (m) {
      const p = make(m);
      return { ...p, to: p.to > today ? today : p.to, said: m[0] };
    }
  }
  return { from: thisMonth, to: today, label: 'this month', said: '' };
}

const clean = (s: string) => s.toLowerCase().replace(/[?.!]+/g, ' ').replace(/\s+/g, ' ').trim();
const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle);

// What matches a few words: a category, plans, expenses (by name, merchant or tag).
function matching(term: string, d: AskData) {
  const t = term.trim().toLowerCase();
  const cats = d.categories.filter(c => c.name.toLowerCase() === t || has(c.name, t));
  const catIds = new Set(cats.map(c => c.id));
  const payments = d.payments.filter(p => (p.categoryId && catIds.has(p.categoryId)) || has(p.name, t)
    || (knownMerchant(p.name) ?? '').toLowerCase() === t || (p.tags ?? []).some(tag => tag.toLowerCase() === t));
  const plans = d.plans.filter(p => (p.categoryId && catIds.has(p.categoryId)) || has(p.name, t));
  return { cats, payments, plans };
}

function spentIn(period: Period, d: AskData, only?: { payments: Payment[]; plans: Plan[] }) {
  const payments = (only?.payments ?? d.payments).filter(p => p.on >= period.from && p.on <= period.to);
  const renewals = (only?.plans ?? d.plans).flatMap(p => renewalsBetween(p, d.events.filter(e => e.planId === p.id), period.from, period.to));
  return { payments, renewals, total: sum([...payments.map(ownAmount), ...renewals.map(r => r.amount)]) };
}

export const EXAMPLES = [
  'How much did I spend on Swiggy last month?',
  'What if I cancel Netflix?',
  'Biggest expense this year',
  'Where did my money go in August?',
  'How much do my subscriptions cost?',
  'Who owes me?',
  'Income this month',
];

export function ask(question: string, d: AskData, today: Day): Answer {
  const q = clean(question);
  if (!q) return { text: 'Ask about your spending, plans or income.' };
  const period = periodOf(q, today);
  const rest = clean(period.said ? q.replace(period.said, ' ') : q);

  // Who owes you.
  const owes = rest.match(/(?:how much )?(?:does|do|did) (.+?) owe|who owes|owe me|owes me/);
  if (owes) {
    const all = owedByPerson(d.payments);
    const who = owes[1] && !/^(i|people|they|friends)$/.test(owes[1]) ? owes[1] : null;
    const list = who ? all.filter(o => o.who.toLowerCase().includes(who)) : all;
    if (!list.length) return { text: who ? `${who[0]!.toUpperCase()}${who.slice(1)} doesn't owe you anything.` : 'Nobody owes you anything right now.' };
    return { text: `${list.length === 1 ? `${list[0]!.who} owes` : 'People owe'} you ${formatRupees(sum(list.map(o => o.amount)))}.`, lines: list.map(o => ({ label: o.who, value: formatRupees(o.amount) })) };
  }

  // What cancelling a plan would keep.
  const cancel = rest.match(/(?:what if |if )?(?:i )?(?:cancel|stop|drop)(?:led)? (?:my )?(.+)/);
  if (cancel) {
    const plans = d.plans.filter(p => has(p.name, cancel[1]!.replace(/^the /, '')) && (p.status === 'active' || p.status === 'trial'));
    if (!plans.length) return { text: `No plan you're paying for matches "${cancel[1]}".` };
    const perMonth = sum(plans.map(p => monthlyCost(planPrice(p), p.cycle)));
    return { text: `Cancelling ${plans.map(p => p.name).join(' and ')} keeps ${formatRupees(paise(perMonth * 12))} a year (${formatRupees(perMonth)} a month).` };
  }

  // Income, what's left, savings.
  if (/\b(income|earn(?:ed|ings)?|salary|savings? rate|saved|save|left over)\b/.test(rest)) {
    const items = incomeBetween(d.incomes, period.from, period.to);
    const income = sum(items.map(i => i.amount));
    const spent = spentIn(period, d).total;
    if (!income) return { text: `No income recorded ${period.label}. Add it under Income & goals.` };
    const left = paise(income - spent);
    return {
      text: `Income ${period.label}: ${formatRupees(income)}. ${formatRupees(spent)} went out, so ${left >= 0 ? `${formatRupees(left)} was left (${Math.round((left / income) * 100)}% saved)` : `you spent ${formatRupees(paise(-left))} more than came in`}.`,
      lines: items.map(i => ({ label: `${i.income.name} · ${i.on}`, value: formatRupees(i.amount) })),
    };
  }

  // What plans cost.
  if (/\b(subscriptions?|plans?)\b/.test(rest) && /\b(cost|spend|pay|total|much)\b/.test(rest) && !/\b(on|for|at) (?!(my )?(subscriptions?|plans?)\b)/.test(rest)) {
    const s = plansSummary(d.plans, d.events, today);
    return { text: `Your plans cost ${formatRupees(s.perMonth)} a month, ${formatRupees(s.perYear)} a year.`, lines: s.billing.slice(0, 8).map(r => ({ label: r.plan.name, value: `${formatRupees(r.perMonth)}/mo` })) };
  }

  // The biggest expense.
  if (/\b(biggest|largest|most expensive|highest)\b/.test(rest) && !/categor/.test(rest)) {
    const s = spentIn(period, d);
    const items = [...s.payments.map(p => ({ name: p.name, on: p.on, amount: ownAmount(p) })), ...s.renewals.map(r => ({ name: r.name, on: r.on, amount: r.amount }))]
      .sort((a, b) => b.amount - a.amount);
    if (!items.length) return { text: `Nothing was spent ${period.label}.` };
    return { text: `Your biggest expense ${period.label} was ${items[0]!.name}: ${formatRupees(items[0]!.amount)} on ${items[0]!.on}.`, lines: items.slice(1, 5).map(i => ({ label: `${i.name} · ${i.on}`, value: formatRupees(i.amount) })) };
  }

  // Where it went, by category.
  if (/categor|where (?:did|does|has) (?:my |the )?money go|where.*go\b|breakdown/.test(rest)) {
    const s = spentIn(period, d);
    const by = new Map<string, number>();
    const name = (id: string | null) => d.categories.find(c => c.id === id)?.name ?? 'Uncategorised';
    for (const p of s.payments) by.set(name(p.categoryId), (by.get(name(p.categoryId)) ?? 0) + ownAmount(p));
    for (const r of s.renewals) { const c = name(d.plans.find(p => p.id === r.planId)?.categoryId ?? null); by.set(c, (by.get(c) ?? 0) + r.amount); }
    if (!s.total) return { text: `Nothing was spent ${period.label}.` };
    const lines = [...by].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: `${formatRupees(v as Paise)} · ${Math.round((v / s.total) * 100)}%` }));
    return { text: `${formatRupees(s.total)} ${period.label}, most of it on ${lines[0]!.label}.`, lines };
  }

  // Spent on something.
  const on = rest.match(/\b(?:spen[dt]|spending|cost|pay|paid|how much)\b.*?\b(?:on|for|at)\s+(.+)$/) ?? rest.match(/^(?:how many times|how often) .*?\b(?:on|for|at|to|from)?\s*(.+)$/);
  const countOnly = /how many times|how often/.test(rest);
  if (on && on[1] && !/^(everything|all|total)$/.test(on[1].trim())) {
    const term = on[1].replace(/^(my|the)\s+/, '').replace(/\s+(so far|in total|altogether)$/, '').trim();
    const m = matching(term, d);
    if (!m.cats.length && !m.payments.length && !m.plans.length) return { text: `Nothing matches "${term}". Try a category, a shop or a plan name.` };
    const s = spentIn(period, d, { payments: m.payments, plans: m.plans });
    const n = s.payments.length + s.renewals.length;
    const label = m.cats.length === 1 ? m.cats[0]!.name : term[0]!.toUpperCase() + term.slice(1);
    if (countOnly) return { text: `${label}: ${n} time${n === 1 ? '' : 's'} ${period.label}, ${formatRupees(s.total)} in all.` };
    return {
      text: n ? `You spent ${formatRupees(s.total)} on ${label} ${period.label} (${n} payment${n === 1 ? '' : 's'}).` : `Nothing on ${label} ${period.label}.`,
      lines: [...s.payments.map(p => ({ label: `${p.name} · ${p.on}`, value: formatRupees(ownAmount(p)) })), ...s.renewals.map(r => ({ label: `${r.name} · ${r.on}`, value: formatRupees(r.amount) }))].slice(0, 8),
    };
  }

  // Everything spent.
  if (/\b(spen[dt]|spending|total|expenses?|how much)\b/.test(rest)) {
    const s = spentIn(period, d);
    return { text: `You spent ${formatRupees(s.total)} ${period.label}: ${formatRupees(sum(s.renewals.map(r => r.amount)))} on plans and ${formatRupees(sum(s.payments.map(ownAmount)))} on everyday expenses.` };
  }

  return { text: "I couldn't work that out. Try one of these:", lines: EXAMPLES.map(e => ({ label: e, value: '' })) };
}
