import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from '../dates.ts';
import { parseBankSms, parseBankSmsList, suggestCategory } from './sms.ts';

const today = parseDay('2026-10-15') as Day;

describe('parseBankSms', () => {
  it.each([
    ['Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 627384910283). Not you? Call 18001234',
      { amount: 25000, on: '2026-10-01', name: 'Swiggy', category: 'Food' }],
    ['Sent Rs.1,499.00 From HDFC Bank A/C *1234 To AMAZON PAY On 02/10/26 Ref 627384910283 Not You?',
      { amount: 149900, on: '2026-10-02', name: 'Amazon Pay', category: 'Shopping' }],
    ['INR 199.00 debited from A/c XX1234 on 05-Oct-26. Info: ACH*NETFLIX.COM. Avl Bal: INR 10,000.00',
      { amount: 19900, on: '2026-10-05', name: 'Netflix', category: 'Entertainment' }],
    ['Rs 349 spent on your HDFC Bank Credit Card ending 1234 at AIRTEL PREPAID on 2026-10-03:14:22:01',
      { amount: 34900, on: '2026-10-03', name: 'Airtel', category: 'Utilities' }],
    ['ICICI Bank Acct XX123 debited for Rs 85.00 on 07-Oct-26; UPI/P2M/628812345/RAPIDO credited. UPI:627384910283',
      { amount: 8500, on: '2026-10-07', name: 'Rapido', category: 'Transport' }],
  ])('%s', (sms, expected) => expect(parseBankSms(sms, today)).toEqual(expected));

  it('ignores credits, refunds and OTPs; defaults the date to today', () => {
    expect(parseBankSms('Rs.500.00 credited to a/c **1234 on 01-10-26 by VPA friend@okaxis', today)).toBeNull();
    expect(parseBankSms('Refund of Rs.120 received from Swiggy', today)).toBeNull();
    expect(parseBankSms('Your OTP is 123456', today)).toBeNull();
    expect(parseBankSms('Paid Rs.40 to CHAI POINT via UPI', today)?.on).toBe('2026-10-15');
  });

  it('several messages at once', () => {
    expect(parseBankSmsList('Rs.250.00 debited from a/c on 01-10-26 to VPA swiggy@icici.\n\nYour OTP is 1\nPaid Rs.40 to CHAI POINT via UPI', today)
      .map(e => [e.name, e.amount])).toEqual([['Swiggy', 25000], ['Chai Point', 4000]]);
    expect(suggestCategory('Random Shop')).toBeNull();
  });
});
