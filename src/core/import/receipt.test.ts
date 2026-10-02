import { describe, expect, it } from 'vitest';
import { parseReceipt } from './receipt.ts';

describe('parseReceipt', () => {
  it('a restaurant bill: name from the top, the grand total (not the subtotal), the date', () => {
    const bill = `TAX INVOICE
Cafe Mocha Indiranagar
GSTIN 29ABCDE1234F1Z5
Date: 28/09/2026  Time 21:14
Paneer Tikka 1 x 320.00   320.00
Cold Coffee 2 x 180.00   360.00
Sub Total                680.00
CGST 2.5%                 17.00
SGST 2.5%                 17.00
Grand Total            ₹ 714.00
Thank you, visit again`;
    expect(parseReceipt(bill)).toEqual({ name: 'Cafe Mocha Indiranagar', amount: 71400, on: '2026-09-28', category: 'Food' });
  });

  it('a UPI payment screenshot', () => {
    const shot = `Payment successful
₹250
Paid to
Swiggy
UPI transaction ID 627384910283
1 Oct 2026, 8:41 pm`;
    expect(parseReceipt(shot)).toMatchObject({ name: 'Swiggy', amount: 25000, on: '2026-10-01', category: 'Food' });
  });

  it('a shop bill with Indian number grouping and "Net Amount"', () => {
    const bill = `DMart Avenue Supermarts
Bill No 4821  05-10-2026
Total Items 14
Net Amount  1,24,560.50`;
    expect(parseReceipt(bill)).toMatchObject({ name: 'DMart', amount: 12456050, on: '2026-10-05' });
  });

  it('falls back to the largest amount when no line says total', () => {
    expect(parseReceipt('Hardware store\nNails 40\nHammer 350\n').amount).toBe(35000);
  });

  it('a whole-rupee total; long ID numbers are not amounts', () => {
    expect(parseReceipt('Sharma Electronics\nInvoice 2026100512345678\nTotal 12450\n').amount).toBe(1245000);
  });

  it('nothing readable', () => expect(parseReceipt('')).toEqual({ name: null, amount: null, on: null, category: null }));
});
