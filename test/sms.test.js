import { describe, expect, it } from 'vitest';
import { parseBankSms, parseBankSmsList, suggestCategory } from '../src/lib/sms.js';

const today = new Date(2026, 9, 15);

describe('parseBankSms', () => {
    it.each([
        [
            'Dear UPI user A/C X1234 debited by 250.00 on date 01Oct26 trf to SWIGGY Refno 627384910283. If not u? call 1800111109. -SBI',
            null, // SBI's "debited by 250.00" has no currency marker: not confident enough
        ],
        [
            'Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 627384910283). Not you? Call 18001234',
            { amount: 250, date: '2026-10-01', name: 'Swiggy', category: 'Food' },
        ],
        [
            'Sent Rs.1,499.00 From HDFC Bank A/C *1234 To AMAZON PAY On 02/10/26 Ref 627384910283 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808',
            { amount: 1499, date: '2026-10-02', name: 'Amazon Pay', category: 'Shopping' },
        ],
        [
            'INR 199.00 debited from A/c XX1234 on 05-Oct-26. Info: ACH*NETFLIX.COM. Avl Bal: INR 10,000.00',
            { amount: 199, date: '2026-10-05', name: 'Netflix', category: 'Entertainment' },
        ],
        [
            'Rs 349 spent on your HDFC Bank Credit Card ending 1234 at AIRTEL PREPAID on 2026-10-03:14:22:01',
            { amount: 349, date: '2026-10-03', name: 'Airtel', category: 'Utilities' },
        ],
        [
            'ICICI Bank Acct XX123 debited for Rs 85.00 on 07-Oct-26; UPI/P2M/628812345/RAPIDO credited. UPI:627384910283',
            { amount: 85, date: '2026-10-07', name: 'Rapido', category: 'Transport' },
        ],
    ])('%s', (sms, expected) => {
        expect(parseBankSms(sms, today)).toEqual(expected);
    });

    it('ignores credits, refunds and messages without an amount', () => {
        expect(parseBankSms('Rs.500.00 credited to a/c **1234 on 01-10-26 by VPA friend@okaxis', today)).toBeNull();
        expect(parseBankSms('Refund of Rs.120 received from Swiggy', today)).toBeNull();
        expect(parseBankSms('Your OTP is 123456', today)).toBeNull();
    });

    it('falls back to today when there is no date', () => {
        expect(parseBankSms('Paid Rs.40 to CHAI POINT via UPI', today).date).toBe('2026-10-15');
    });
});

describe('parseBankSmsList', () => {
    it('reads several messages pasted together and skips the rest', () => {
        const list = parseBankSmsList([
            'Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 1).',
            '',
            'Your OTP is 123456',
            'Paid Rs.40 to CHAI POINT via UPI',
        ].join('\n'), today);
        expect(list.map(e => [e.name, e.amount])).toEqual([['Swiggy', 250], ['Chai Point', 40]]);
    });
});

describe('suggestCategory', () => {
    it('knows common Indian merchants', () => {
        expect(suggestCategory('ZEPTO MARKETPLACE')).toBe('Food');
        expect(suggestCategory('IRCTC')).toBe('Transport');
        expect(suggestCategory('Random Shop')).toBeNull();
    });
});
