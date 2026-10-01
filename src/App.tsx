import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { dbFor, readAll } from './data/db.ts';
import { supabase } from './data/supabase.ts';
import { AddSheet } from './screens/AddSheet.tsx';
import { Month } from './screens/Month.tsx';
import { SignIn } from './screens/SignIn.tsx';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    window.atlerLaunch?.step(0.6, 'Checking your session…');
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) window.atlerLaunch?.done();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // the launch screen is still up
  if (!session) return <SignIn />;
  return <SignedIn session={session} />;
}

function SignedIn({ session }: { session: Session }) {
  const db = useMemo(() => dbFor(session.user.id), [session.user.id]);
  const data = useLiveQuery(() => readAll(db), [db]);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => { window.atlerLaunch?.step(0.85, 'Opening your data…'); }, []);
  useEffect(() => { if (data) window.atlerLaunch?.done(); }, [data]);
  if (!data) return null;

  const who = (session.user.user_metadata?.name as string | undefined) || session.user.email || 'You';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32">
      <header className="relative flex items-center justify-between px-1 pt-2 pb-3">
        <div className="font-display text-xl leading-none font-bold tracking-[0.08em]">ATLER</div>
        <button
          type="button"
          aria-label={`Account: ${who}`}
          aria-expanded={menu}
          onClick={() => setMenu(m => !m)}
          className="flex size-[38px] items-center justify-center rounded-xl bg-block-2 font-extrabold"
        >
          {who.charAt(0).toUpperCase()}
        </button>
        {menu && (
          <div className="absolute top-14 right-1 z-10 w-60 rounded-tile bg-block-2 p-3 shadow-2xl">
            <div className="truncate px-1 pb-2 text-sm text-ink-2">{session.user.email}</div>
            <button type="button" onClick={() => supabase.auth.signOut()} className="h-11 w-full rounded-control bg-block text-sm font-bold text-danger">Sign out</button>
          </div>
        )}
      </header>

      <main>
        <h1 className="sr-only">Your month</h1>
        <Month plans={data.plans} events={data.events} payments={data.payments} onAdd={() => setAdding(true)} />
      </main>

      <nav aria-label="Main" className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-block-2 p-2">
        <a href="#month" aria-current="page" className="flex h-11 items-center rounded-full bg-here px-5 text-[13px] font-extrabold text-on-color">Month</a>
        <button type="button" aria-label="Add a plan or expense" onClick={() => setAdding(true)} className="flex size-11 items-center justify-center rounded-full bg-money text-on-color">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </nav>

      <AddSheet db={db} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
