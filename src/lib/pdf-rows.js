// Rebuilds table rows from the positioned text pieces pdf.js gives us, so a
// PDF statement can go through the same reader as a CSV one. Pure; the pdf.js
// part lives in pdf-statement.js.
import { toCsv } from './csv.js';

const HEADER = { date: /\bdate\b/i, description: /narration|description|particulars|remarks|details/i };

// Pieces on one baseline form a line; a gap wider than `gapFactor` x the text
// height starts a new cell. Returns lines of { text, x0, x1 } cells, top first.
function itemsToLines(items, gapFactor) {
    const pieces = items.filter(i => i.str && i.str.trim());
    const lines = [];
    for (const piece of [...pieces].sort((a, b) => b.y - a.y || a.x - b.x)) {
        const tolerance = Math.max(2, (piece.height || 10) * 0.5);
        const line = lines.find(l => Math.abs(l.y - piece.y) <= tolerance);
        if (line) line.items.push(piece);
        else lines.push({ y: piece.y, items: [piece] });
    }
    return lines.map(line => {
        const cells = [];
        let current = null;
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

const isHeader = cells => cells.some(c => HEADER.date.test(c.text)) && cells.some(c => HEADER.description.test(c.text));
const center = c => (c.x0 + c.x1) / 2;

// One page -> rows of strings. Once a header row is seen (on this page or,
// via `columns`, an earlier one), every cell is put in the column whose
// header is horizontally closest, so an empty Withdrawal cell can't shift a
// Deposit amount into the Withdrawal column. Returns { rows, columns }.
export function pageToRows(items, { columns = null, gapFactor = 0.9 } = {}) {
    let cols = columns;
    const rows = [];
    for (const cells of itemsToLines(items, gapFactor)) {
        if (isHeader(cells)) cols = cells.map(center);
        if (!cols) {
            rows.push(cells.map(c => c.text));
            continue;
        }
        const row = cols.map(() => '');
        for (const cell of cells) {
            let best = 0;
            cols.forEach((x, i) => { if (Math.abs(center(cell) - x) < Math.abs(center(cell) - cols[best])) best = i; });
            row[best] = row[best] ? `${row[best]} ${cell.text}` : cell.text;
        }
        rows.push(row);
    }
    return { rows, columns: cols };
}

// Rows from every page -> CSV text that readStatement understands.
export function rowsToCsv(rows) {
    const width = Math.max(0, ...rows.map(r => r.length));
    const headers = Array.from({ length: width }, (_, i) => ({ key: i, label: '' }));
    return toCsv(rows.map(r => Object.fromEntries(r.map((c, i) => [i, c]))), headers).split('\n').slice(1).join('\n');
}
