import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from '../dates.ts';
import { cycleFromGap, findRecurring, merchantName, moneyCell, parseStatementDate, readStatement } from './statement.ts';

const d = (s: string) => parseDay(s) as Day;

describe('parseStatementDate', () => {
  it.each([
    ['05/10/2026', '2026-10-05'], ['5-10-26', '2026-10-05'], ['05-Oct-2026', '2026-10-05'],
    ['05 Oct 26', '2026-10-05'], ['2026-10-05', '2026-10-05'], ['31/02/2026', null], ['Opening balance', null],
  ])('%s -> %s', (input, expected) => expect(parseStatementDate(input)).toBe(expected));
});

describe('moneyCell', () => {
  it.each([['1,499.00', 149900], ['₹ 85', 8500], ['-119', -11900], ['INR 250.5', 25050], ['', null], ['abc', null], ['1.999', null]])(
    '%s -> %s', (input, expected) => expect(moneyCell(input)).toBe(expected));
});

describe('merchantName', () => {
  it.each([
    ['UPI-NETFLIX COM-netflixupi@hdfcbank-HDFC0000001-627384910283-PAYMENT', 'Netflix'],
    ['ACH D- TP ACH SPOTIFYINDIA-123456789', 'Spotify'],
    ['POS 412345XXXXXX1234 GOOGLE YOUTUBE PREM', 'YouTube Premium'],
    ['UPI/P2M/628812345/CRED CLUB/crefclub@axis/Payment', 'Cred Club'],
    ['UPI-627384910283-1234', null],
  ])('%s -> %s', (input, expected) => expect(merchantName(input)).toBe(expected));
});

describe('cycleFromGap', () => {
  it.each([
    [30, { unit: 'month', every: 1 }], [28, { unit: 'day', every: 28 }], [365, { unit: 'year', every: 1 }],
    [7, { unit: 'day', every: 7 }], [91, { unit: 'month', every: 3 }], [45, null],
  ])('%d days', (days, cycle) => expect(cycleFromGap(days)).toEqual(cycle));
});

const hdfc = `HDFC BANK Ltd.,,,,,,
Statement of accounts,,,,,,
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
05/06/26,UPI-NETFLIX COM-netflixupi@hdfcbank-627384910001-PAYMENT,0001,05/06/26,199.00,,10000.00
05/07/26,UPI-NETFLIX COM-netflixupi@hdfcbank-627384910002-PAYMENT,0002,05/07/26,199.00,,9801.00
06/08/26,UPI-NETFLIX COM-netflixupi@hdfcbank-627384910003-PAYMENT,0003,06/08/26,199.00,,9602.00
05/09/26,UPI-NETFLIX COM-netflixupi@hdfcbank-627384910004-PAYMENT,0004,05/09/26,249.00,,9353.00
12/06/26,POS AIRTEL PREPAID RECHARGE,0005,12/06/26,349.00,,9000.00
10/07/26,POS AIRTEL PREPAID RECHARGE,0006,10/07/26,349.00,,8651.00
07/08/26,POS AIRTEL PREPAID RECHARGE,0007,07/08/26,349.00,,8302.00
04/09/26,POS AIRTEL PREPAID RECHARGE,0008,04/09/26,349.00,,7953.00
02/10/26,POS AIRTEL PREPAID RECHARGE,0009,02/10/26,349.00,,7604.00
03/06/26,UPI-SWIGGY-swiggy@icici-1,0010,03/06/26,412.00,,7000.00
19/06/26,UPI-SWIGGY-swiggy@icici-2,0011,19/06/26,233.00,,6800.00
02/08/26,UPI-SWIGGY-swiggy@icici-3,0012,02/08/26,598.00,,6200.00
01/07/26,SALARY OCT,0013,01/07/26,,50000.00,56200.00
20/04/26,UPI-GYM MEMBERSHIP-gym@ybl-1,0014,20/04/26,1500.00,,5000.00
20/05/26,UPI-GYM MEMBERSHIP-gym@ybl-2,0015,20/05/26,1500.00,,3500.00
20/06/26,UPI-GYM MEMBERSHIP-gym@ybl-3,0016,20/06/26,1500.00,,2000.00
`;

describe('readStatement', () => {
  it('finds the header under the preamble and keeps debits only, in paise', () => {
    const debits = readStatement(hdfc);
    expect(debits).toHaveLength(15);
    expect(debits.some(x => /SALARY/.test(x.description))).toBe(false);
    expect(debits[0]).toEqual({ on: '2026-06-05', description: expect.stringContaining('NETFLIX'), amount: 19900 });
  });

  it('signed Amount columns and Amount + Dr/Cr columns', () => {
    expect(readStatement('Date,Description,Amount\n2026-09-01,Spotify,-119\n2026-09-02,Refund,50\n').map(x => [x.description, x.amount])).toEqual([['Spotify', 11900]]);
    expect(readStatement('Txn Date,Particulars,Amount,Dr/Cr\n01-Sep-2026,Spotify,119.00,DR\n02-Sep-2026,Refund,50.00,CR\n').map(x => x.description)).toEqual(['Spotify']);
  });

  it('explains when it cannot find the columns', () => {
    expect(() => readStatement('a,b,c\n1,2,3\n')).toThrow(/Date \/ Description \/ Debit/);
  });
});

describe('findRecurring', () => {
  const found = findRecurring(readStatement(hdfc), d('2026-10-10'), ['Gym Membership']);
  const by = (name: string) => found.find(f => f.name === name);

  it('a monthly plan, at its latest price', () => {
    expect(by('Netflix')).toMatchObject({ cycle: { unit: 'month', every: 1 }, price: 24900, lastCharged: '2026-09-05', charges: 4, active: true, perMonth: 24900 });
  });

  it('a 28-day prepaid recharge', () => {
    expect(by('Airtel')).toMatchObject({ cycle: { unit: 'day', every: 28 }, price: 34900, charges: 5, active: true });
  });

  it('ignores irregular spending; flags stopped and already-tracked plans', () => {
    expect(by('Swiggy')).toBeUndefined();
    expect(by('Gym Membership')).toMatchObject({ active: false, alreadyTracked: true });
    expect(by('Gym Membership')!.confidence).toBeLessThan(by('Airtel')!.confidence);
  });

  it('two charges a month apart are not enough; two plans at one merchant are split', () => {
    expect(findRecurring(readStatement('Date,Narration,Withdrawal Amt.\n01/08/26,UPI-ZOMATO-z@x,300\n01/09/26,UPI-ZOMATO-z@x,300\n'), d('2026-10-10'))).toEqual([]);
    const rows = ['Date,Narration,Withdrawal Amt.'];
    for (const m of ['06', '07', '08', '09']) rows.push(`03/${m}/26,GOOGLE ONE STORAGE,130.00`, `15/${m}/26,GOOGLE PLAY APPS,650.00`);
    expect(findRecurring(readStatement(rows.join('\n')), d('2026-10-10')).map(p => p.price).sort((a, b) => a - b)).toEqual([13000, 65000]);
  });

  it('a quarterly plan becomes a 3-month cycle', () => {
    const rows = ['Date,Narration,Withdrawal Amt.', '10/01/26,ACT FIBERNET,2400', '10/04/26,ACT FIBERNET,2400', '10/07/26,ACT FIBERNET,2400', '10/10/26,ACT FIBERNET,2400'];
    expect(findRecurring(readStatement(rows.join('\n')), d('2026-10-12'))[0]).toMatchObject({ name: 'ACT Fibernet', cycle: { unit: 'month', every: 3 }, perMonth: 80000 });
  });
});
