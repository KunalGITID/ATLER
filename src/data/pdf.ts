// A PDF statement -> CSV text for readStatement. pdf.js is large, so it's only
// loaded when someone actually picks a PDF.
import { pageToRows, rowsToCsv } from '../core/import/pdfRows.ts';

export class PdfPasswordError extends Error {
  readonly wrong: boolean;
  constructor(wrong: boolean) {
    super(wrong ? 'That password is not right.' : 'This PDF is locked with a password.');
    this.wrong = wrong;
  }
}

export async function pdfToCsv(file: File, password?: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password }).promise;
  } catch (err) {
    if ((err as { name?: string }).name === 'PasswordException') throw new PdfPasswordError(Boolean(password));
    throw new Error('Could not open that PDF.', { cause: err });
  }
  const rows: string[][] = [];
  let columns: number[] | null = null;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const result = pageToRows(items.filter(i => 'str' in i).map(i => {
      const t = i as { str: string; transform: number[]; width: number; height: number };
      return { str: t.str, x: t.transform[4]!, y: t.transform[5]!, width: t.width, height: t.height || Math.abs(t.transform[3]!) || 10 };
    }), { columns });
    columns = result.columns;
    rows.push(...result.rows);
  }
  await doc.destroy();
  if (!rows.length) throw new Error('There is no text in that PDF. A scanned statement (a photo) cannot be read.');
  return rowsToCsv(rows);
}
