// Expenses from another app's export: Walnut, Splitwise, or any CSV with a
// date, a description and an amount (a bank statement works too). Pure; the
// screen reads the file and saves what's picked.
import type { Day } from '../dates.ts';
import type { Paise } from '../money.ts';
import { paise } from '../money.ts';
import { parseCsv } from './csv.ts';
import { merchantName, moneyCell, parseStatementDate, readStatement } from './statement.ts';

export interface ImportedExpense { name: string; amount: Paise; on: Day; category: string | null; note: string; tags: string[] }
export interface ExpenseImport { format: 'walnut' | 'splitwise' | 'statement'; expenses: ImportedExpense[]; skipped: number }

const norm = (s: string) => s.trim().toLowerCase();

export function readExpenses(text: string): ExpenseImport {
  const rows = parseCsv(text.replace(/^﻿/, '')).filter(r => r.some(c => c.trim()));
  const headerAt = rows.slice(0, 20).findIndex(r => r.some(c => /^date$/i.test(c.trim())));
  const header = headerAt >= 0 ? rows[headerAt]!.map(norm) : [];
  const col = (...names: string[]) => header.findIndex(h => names.includes(h));
  const body = headerAt >= 0 ? rows.slice(headerAt + 1) : [];

  // Splitwise: Date, Description, Category, Cost, Currency, then one column per person.
  if (col('cost') >= 0 && col('currency') >= 0 && col('description') >= 0) {
    const [cDate, cDesc, cCat, cCost] = [col('date'), col('description'), col('category'), col('cost')];
    const expenses: ImportedExpense[] = [];
    let skipped = 0;
    for (const r of body) {
      const on = parseStatementDate(r[cDate]);
      const amount = moneyCell(r[cCost]);
      const category = cCat >= 0 ? (r[cCat] ?? '').trim() : '';
      // "Payment" rows are settle-ups between friends, not spending.
      if (!on || amount === null || amount <= 0 || /^payment$/i.test(category) || /total balance/i.test(r[cDesc] ?? '')) { skipped++; continue; }
      expenses.push({ name: (r[cDesc] ?? '').trim() || 'Splitwise expense', amount: paise(amount), on, category: category && !/^general$/i.test(category) ? category : null, note: '', tags: ['splitwise'] });
    }
    return { format: 'splitwise', expenses, skipped };
  }

  // Walnut: DATE, TIME, PLACE, AMOUNT, DR/CR, ACCOUNT, EXPENSE, INCOME, CATEGORY, TAGS, NOTE.
  if (col('place') >= 0 && col('amount') >= 0) {
    const [cDate, cPlace, cAmount, cDrCr, cExpense, cCat, cTags, cNote] =
      [col('date'), col('place'), col('amount'), col('dr/cr'), col('expense'), col('category'), col('tags'), col('note')];
    const expenses: ImportedExpense[] = [];
    let skipped = 0;
    for (const r of body) {
      const on = parseStatementDate(r[cDate]);
      const amount = moneyCell(r[cAmount]);
      const isDebit = cDrCr >= 0 ? /^dr/i.test((r[cDrCr] ?? '').trim()) : true;
      const isExpense = cExpense >= 0 ? !/^(no|false|0)$/i.test((r[cExpense] ?? '').trim()) : true;
      if (!on || amount === null || amount <= 0 || !isDebit || !isExpense) { skipped++; continue; }
      const place = (r[cPlace] ?? '').trim();
      expenses.push({
        name: merchantName(place) ?? (place || 'Walnut expense'),
        amount: paise(Math.abs(amount)), on,
        category: cCat >= 0 ? (r[cCat] ?? '').trim() || null : null,
        note: cNote >= 0 ? (r[cNote] ?? '').trim() : '',
        tags: cTags >= 0 ? (r[cTags] ?? '').split(/[,#;]/).map(t => t.trim().toLowerCase()).filter(Boolean) : [],
      });
    }
    return { format: 'walnut', expenses, skipped };
  }

  // Anything else: read it like a bank statement (debits only).
  const debits = readStatement(text);
  return {
    format: 'statement',
    expenses: debits.map(x => ({ name: merchantName(x.description) ?? x.description.slice(0, 60), amount: x.amount, on: x.on, category: null, note: '', tags: [] })),
    skipped: 0,
  };
}

// Already in ATLER? Same day, amount and name (any case).
export const sameExpense = (a: { name: string; amount: number; on: string }, b: { name: string; amount: number; on: string }) =>
  a.on === b.on && a.amount === b.amount && norm(a.name) === norm(b.name);
