import { describe, expect, it } from 'vitest';
import { readExpenses } from './expenses.ts';

describe('readExpenses', () => {
  it('Splitwise: the cost of each expense, settle-ups skipped', () => {
    const csv = `Date,Description,Category,Cost,Currency,Asha,Me
2026-09-14,Goa villa,Lodging,24000.00,INR,-12000.00,12000.00
2026-09-15,Dinner,Dining out,3200.50,INR,1600.25,-1600.25
2026-09-20,Settle up,Payment,12000.00,INR,12000.00,-12000.00

2026-09-30,Total balance, , ,INR,0.00,0.00`;
    const r = readExpenses(csv);
    expect(r.format).toBe('splitwise');
    expect(r.expenses.map(e => [e.name, e.amount, e.on, e.category])).toEqual([
      ['Goa villa', 2400000, '2026-09-14', 'Lodging'], ['Dinner', 320050, '2026-09-15', 'Dining out'],
    ]);
    expect(r.skipped).toBe(2);
  });

  it('Walnut: debits marked as expenses, with category, tags and note', () => {
    const csv = `DATE,TIME,PLACE,AMOUNT,DR/CR,ACCOUNT,EXPENSE,INCOME,CATEGORY,TAGS,NOTE
04-10-26,08:15 PM,SWIGGY BANGALORE,450.00,DR,HDFC 1234,Yes,No,Food,"weekend,dinner",with Ravi
05-10-26,09:00 AM,SALARY,90000.00,CR,HDFC 1234,No,Yes,Income,,
06-10-26,10:00 AM,Transfer to self,5000.00,DR,HDFC 1234,No,No,Transfer,,`;
    const r = readExpenses(csv);
    expect(r.format).toBe('walnut');
    expect(r.expenses).toEqual([{ name: 'Swiggy', amount: 45000, on: '2026-10-04', category: 'Food', note: 'with Ravi', tags: ['weekend', 'dinner'] }]);
    expect(r.skipped).toBe(2);
  });

  it('a plain bank CSV becomes expenses with clean names', () => {
    const r = readExpenses('Date,Narration,Withdrawal Amt.\n01/10/26,UPI/DR/4029/ZOMATO/HDFC,320\n');
    expect(r.format).toBe('statement');
    expect(r.expenses[0]).toMatchObject({ name: 'Zomato', amount: 32000, on: '2026-10-01' });
  });
});
