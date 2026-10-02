// Loads the category prior once, on demand (about 13 KB gzipped).
import { useEffect, useState } from 'react';
import type { Prior } from '../core/categoryPrior.ts';

let loading: Promise<Prior | null> | null = null;

export function loadPrior(): Promise<Prior | null> {
  loading ??= import('../core/categoryPrior.json').then(m => m.default as Prior).catch(() => null);
  return loading;
}

export function usePrior(): Prior | null {
  const [prior, setPrior] = useState<Prior | null>(null);
  useEffect(() => {
    let live = true;
    void loadPrior().then(p => live && setPrior(p));
    return () => { live = false; };
  }, []);
  return prior;
}
