// Stamp a local edit: when it happened (last edit wins across devices) and
// that it still has to be sent. Also tells the sync loop there's work.
export function touched() {
  queueMicrotask(() => window.dispatchEvent(new Event('atler:changed')));
  return { updatedAt: Date.now(), dirty: 1 as const };
}
