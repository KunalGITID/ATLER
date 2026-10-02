import { describe, expect, it } from 'vitest';
import { pageToRows, rowsToCsv, type TextPiece } from './pdfRows.ts';
import { readStatement } from './statement.ts';

const t = (str: string, x: number, y: number): TextPiece => ({ str, x, y, width: str.length * 6, height: 10 });
const header = (y: number) => [t('Date', 40, y), t('Narration', 120, y), t('Withdrawal', 380, y), t('Deposit', 470, y), t('Balance', 540, y)];

describe('pageToRows', () => {
  it('puts each amount under its own column, even with an empty cell', () => {
    const { rows } = pageToRows([
      t('ACME BANK', 40, 760), ...header(700),
      t('05/09/26', 40, 680), t('UPI-NETFLIX', 120, 680.5), t('COM', 188, 680), t('199.00', 396, 680), t('9801.00', 545, 680),
      t('06/09/26', 40, 660), t('SALARY', 120, 660), t('50000.00', 474, 660), t('59801.00', 542, 660),
    ]);
    expect(rows).toEqual([
      ['ACME BANK'],
      ['Date', 'Narration', 'Withdrawal', 'Deposit', 'Balance'],
      ['05/09/26', 'UPI-NETFLIX COM', '199.00', '', '9801.00'],
      ['06/09/26', 'SALARY', '', '50000.00', '59801.00'],
    ]);
  });

  it('carries columns onto a page without a header; salaries are not debits', () => {
    const first = pageToRows(header(700));
    expect(pageToRows([t('07/09/26', 40, 700), t('RAPIDO', 120, 700), t('85.00', 400, 700)], { columns: first.columns }).rows)
      .toEqual([['07/09/26', 'RAPIDO', '85.00', '', '']]);
    const { rows } = pageToRows([...header(700), t('05/09/26', 40, 680), t('UPI-NETFLIX COM', 120, 680), t('199.00', 396, 680), t('06/09/26', 40, 660), t('SALARY', 120, 660), t('50000.00', 474, 660)]);
    expect(readStatement(rowsToCsv(rows)).map(x => [x.description, x.amount])).toEqual([['UPI-NETFLIX COM', 19900]]);
  });
});
