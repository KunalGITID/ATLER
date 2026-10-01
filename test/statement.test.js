import { describe, expect, it } from 'vitest';
import { cycleFromGap, findRecurring, merchantName, parseStatementDate, readStatement } from '../src/lib/statement.js';

const key = d => d && d.toLocaleDateString('en-CA');

describe('parseStatementDate', () => {
    it.each([
        ['05/10/2026', '2026-10-05'], ['5-10-26', '2026-10-05'], ['05-Oct-2026', '2026-10-05'],
        ['05 Oct 26', '2026-10-05'], ['2026-10-05', '2026-10-05'], ['31/02/2026', undefined], ['Opening balance', undefined],
    ])('%s', (input, expected) => {
        expect(key(parseStatementDate(input)) ?? undefined).toBe(expected);
    });
});

describe('merchantName', () => {
    it.each([
        ['UPI-NETFLIX COM-netflixupi@hdfcbank-HDFC0000001-627384910283-PAYMENT', 'Netflix'],
        ['ACH D- TP ACH SPOTIFYINDIA-123456789', 'Spotify'],
        ['POS 412345XXXXXX1234 GOOGLE YOUTUBE PREM', 'YouTube Premium'],
        ['UPI/P2M/628812345/CRED CLUB/crefclub@axis/Payment', 'Cred Club'],
        ['NEFT-RENT FOR OCTOBER-MR SHARMA', 'Rent October'],
        ['UPI-627384910283-1234', null],
    ])('%s -> %s', (input, expected) => {
        expect(merchantName(input)).toBe(expected);
    });
});

describe('cycleFromGap', () => {
    it.each([[30, 'Monthly'], [28, '28'], [31, 'Monthly'], [365, 'Yearly'], [7, '7'], [84, '84'], [45, null], [3, null]])('%d days -> %s', (d, c) => {
        expect(cycleFromGap(d)).toBe(c);
    });
});

const hdfc = `HDFC BANK Ltd.,,,,,,
Statement of accounts,,,,,,
,,,,,,
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
    it('finds the header under the bank preamble and keeps debits only', () => {
        const debits = readStatement(hdfc);
        expect(debits).toHaveLength(15);
        expect(debits.every(d => d.amount > 0)).toBe(true);
        expect(debits.some(d => /SALARY/.test(d.description))).toBe(false);
    });

    it('handles a signed Amount column', () => {
        const csv = 'Date,Description,Amount\n2026-09-01,Spotify,-119\n2026-09-02,Refund,50\n';
        expect(readStatement(csv).map(d => [d.description, d.amount])).toEqual([['Spotify', 119]]);
    });

    it('handles an Amount + Dr/Cr column', () => {
        const csv = 'Txn Date,Particulars,Amount,Dr/Cr\n01-Sep-2026,Spotify,119.00,DR\n02-Sep-2026,Refund,50.00,CR\n';
        expect(readStatement(csv).map(d => d.description)).toEqual(['Spotify']);
    });

    it('explains when it cannot find the columns', () => {
        expect(() => readStatement('a,b,c\n1,2,3\n')).toThrow(/Date \/ Description \/ Debit/);
    });
});

describe('findRecurring', () => {
    const today = new Date(2026, 9, 10);
    const found = findRecurring(readStatement(hdfc), { today, existingNames: ['Gym Membership'] });
    const by = name => found.find(f => f.name === name);

    it('spots a monthly plan and uses the latest price', () => {
        expect(by('Netflix')).toMatchObject({ cycle: 'Monthly', price: 249, lastCharged: '2026-09-05', charges: 4, active: true });
    });

    it('spots a 28-day prepaid recharge', () => {
        expect(by('Airtel')).toMatchObject({ cycle: '28', price: 349, charges: 5, active: true });
    });

    it('ignores irregular spending at the same merchant', () => {
        expect(by('Swiggy')).toBeUndefined();
    });

    it('marks plans that stopped and ones already tracked', () => {
        expect(by('Gym Membership')).toMatchObject({ active: false, alreadyTracked: true });
        expect(by('Gym Membership').confidence).toBeLessThan(by('Airtel').confidence);
    });

    it('does not treat two charges a month apart as a subscription', () => {
        const two = readStatement('Date,Narration,Withdrawal Amt.\n01/08/26,UPI-ZOMATO-z@x,300\n01/09/26,UPI-ZOMATO-z@x,300\n');
        expect(findRecurring(two, { today })).toEqual([]);
    });

    it('separates two plans billed by the same merchant', () => {
        const rows = ['Date,Narration,Withdrawal Amt.'];
        for (const m of ['06', '07', '08', '09']) {
            rows.push(`03/${m}/26,GOOGLE ONE STORAGE,130.00`);
            rows.push(`15/${m}/26,GOOGLE PLAY APPS,650.00`);
        }
        const plans = findRecurring(readStatement(rows.join('\n')), { today });
        expect(plans.map(p => [p.name, p.price, p.cycle]).sort()).toEqual([
            ['Google One / Play', 130, 'Monthly'],
            ['Google One / Play', 650, 'Monthly'],
        ]);
    });
});
