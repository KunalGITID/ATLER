// Rebuilds table rows from the positioned text pdf.js gives us, so a PDF
// statement goes through the same reader as a CSV one. Pure (no pdf.js here).
import { toCsv } from './csv.ts';

export interface TextPiece { str: string; x: number; y: number; width: number; height: number }
interface Cell { text: string; x0: number; x1: number }

const HEADER = { date: /\bdate\b/i, description: /narration|description|particulars|remarks|details/i };

// Pieces on one baseline form a line; a gap wider than gapFactor x the text
// height starts a new cell. Lines come back top first.
function itemsToLines(items: readonly TextPiece[], gapFactor: number): Cell[][] {
  const lines: Array<{ y: number; items: TextPiece[] }> = [];
  for (const piece of items.filter(i => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tolerance = Math.max(2, (piece.height || 10) * 0.5);
    const line = lines.find(l => Math.abs(l.y - piece.y) <= tolerance);
    if (line) line.items.push(piece); else lines.push({ y: piece.y, items: [piece] });
  }
  return lines.map(line => {
    const cells: Cell[] = [];
    let current: Cell | null = null;
    for (const piece of line.items.sort((a, b) => a.x - b.x)) {
      const gap = current ? piece.x - current.x1 : Infinity;
      if (current && gap <= (piece.height || 10) * gapFactor) {
        current.text += (gap > 1 ? ' ' : '') + piece.str.trim();
        current.x1 = piece.x + piece.width;
      } else {
        current = { text: piece.str.trim(), x0: piece.x, x1: piece.x + piece.width };
        cells.push(current);
      }
    }
    return cells;
  });
}

const isHeader = (cells: Cell[]) => cells.some(c => HEADER.date.test(c.text)) && cells.some(c => HEADER.description.test(c.text));
const center = (c: Cell) => (c.x0 + c.x1) / 2;

// One page -> rows. After a header row (this page or an earlier one, via
// `columns`), each cell goes to the column whose header is horizontally
// closest, so an empty Withdrawal cell can't shift a Deposit into it (which
// would count a salary as spending).
export function pageToRows(items: readonly TextPiece[], { columns = null as number[] | null, gapFactor = 0.9 } = {}) {
  let cols = columns;
  const rows: string[][] = [];
  for (const cells of itemsToLines(items, gapFactor)) {
    if (isHeader(cells)) cols = cells.map(center);
    if (!cols) { rows.push(cells.map(c => c.text)); continue; }
    const row = cols.map(() => '');
    for (const cell of cells) {
      let best = 0;
      cols.forEach((x, i) => { if (Math.abs(center(cell) - x) < Math.abs(center(cell) - cols![best]!)) best = i; });
      row[best] = row[best] ? `${row[best]} ${cell.text}` : cell.text;
    }
    rows.push(row);
  }
  return { rows, columns: cols };
}

export const rowsToCsv = (rows: readonly string[][]) => toCsv(rows);
