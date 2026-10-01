// Builds a bank-statement-like PDF (header + table) for tests.
import { PDFDocument, StandardFonts } from 'pdf-lib';

const COLUMNS = [40, 110, 380, 460, 530]; // Date, Narration, Withdrawal, Deposit, Balance

export async function makeStatementPdf(rows) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let page = doc.addPage([600, 800]);
    let y = 760;
    const line = cells => {
        if (y < 60) { page = doc.addPage([600, 800]); y = 760; }
        cells.forEach((text, i) => text && page.drawText(String(text), { x: COLUMNS[i], y, size: 8, font }));
        y -= 16;
    };
    page.drawText('ACME BANK - Statement of account', { x: 40, y: 780, size: 11, font });
    line(['Date', 'Narration', 'Withdrawal', 'Deposit', 'Balance']);
    rows.forEach(line);
    return Buffer.from(await doc.save());
}
