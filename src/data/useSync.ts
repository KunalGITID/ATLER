import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AtlerDB } from './db.ts';
import { syncOnce, waitingCount } from './sync.ts';
import { reportError } from './errors.ts';

export interface SyncState {
  status: 'syncing' | 'synced' | 'offline' | 'error';
  lastSynced: number | null;
  waiting: number;          // local changes not yet on the server
  firstDone: boolean;       // at least one sync attempt has finished this session
  error: string | null;
}

const isNetwork = (e: unknown) => !navigator.onLine || /fetch|network|load failed/i.test(String((e as Error)?.message ?? e));

// Runs sync: on open, after local changes (debounced), when the phone comes
// back online or the app comes back to the front, and once a minute.
export function useSync(db: AtlerDB, userId: string): SyncState {
  const [state, setState] = useState<Omit<SyncState, 'waiting'>>({ status: 'syncing', lastSynced: null, firstDone: false, error: null });
  const waiting = useLiveQuery(() => waitingCount(db), [db]) ?? 0;
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (): Promise<void> => {
      if (running.current) { again.current = true; return running.current; }
      running.current = (async () => {
        if (!navigator.onLine) {
          if (alive) setState(s => ({ ...s, status: 'offline', firstDone: true }));
          return;
        }
        if (alive) setState(s => ({ ...s, status: 'syncing' }));
        try {
          await syncOnce(db, userId);
          if (alive) setState({ status: 'synced', lastSynced: Date.now(), firstDone: true, error: null });
        } catch (e) {
          if (!isNetwork(e)) reportError('write', e, { during: 'sync' });
          if (alive) setState(s => ({ ...s, status: isNetwork(e) ? 'offline' : 'error', firstDone: true, error: isNetwork(e) ? null : String((e as Error).message ?? e) }));
        }
      })().finally(() => {
        running.current = null;
        if (again.current) { again.current = false; void run(); }
      });
      return running.current;
    };

    const soon = () => { clearTimeout(timer); timer = setTimeout(run, 1200); };
    const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
    void run();
    window.addEventListener('atler:changed', soon);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    const every = setInterval(run, 60_000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(every);
      window.removeEventListener('atler:changed', soon);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [db, userId]);

  return { ...state, waiting };
}
