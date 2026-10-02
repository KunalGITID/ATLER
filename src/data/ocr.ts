// Reading the text on a photo of a bill or a payment screenshot, on the
// phone (Tesseract compiled to WebAssembly). The engine and its English data
// (a few MB) are fetched the first time you scan; the photo itself never
// leaves the phone. Loaded only when used.
export async function readImageText(image: File | Blob, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: m => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
