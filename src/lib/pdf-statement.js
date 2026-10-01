// Reads a PDF bank statement into CSV text for readStatement. pdf.js is big,
// so it's imported only when someone actually picks a PDF.
import { pageToRows, rowsToCsv } from './pdf-rows.js';

export class PdfPasswordError extends Error {
    constructor(wrong) {
        super(wrong ? 'That password is not right.' : 'This PDF is password protected.');
        this.code = 'PDF_PASSWORD';
        this.wrong = wrong;
    }
}

export async function pdfStatementToCsv(file, password) {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    let doc;
    try {
        doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password }).promise;
    } catch (err) {
        if (err?.name === 'PasswordException') throw new PdfPasswordError(Boolean(password));
        throw new Error('Could not open that PDF.', { cause: err });
    }

    const rows = [];
    let columns = null;
    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const { items } = await page.getTextContent();
        const result = pageToRows(items.map(i => ({
            str: i.str,
            x: i.transform[4],
            y: i.transform[5],
            width: i.width,
            height: i.height || Math.abs(i.transform[3]) || 10,
        })), { columns });
        columns = result.columns;
        rows.push(...result.rows);
    }
    await doc.destroy();
    if (!rows.length) throw new Error('No text in that PDF. A scanned statement (an image) cannot be read.');
    return rowsToCsv(rows);
}
