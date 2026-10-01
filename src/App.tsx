import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { dbFor, readAll } from './data/db.ts';
import { supabase } from './data/supabase.ts';
import { AddSheet } from './screens/AddSheet.tsx';
import { Month } from './screens/Month.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { PlanDetails } from './screens/PlanDetails.tsx';
import { Plans } from './screens/Plans.tsx';
import { You } from './screens/You.tsx';
import { useRoute } from './route.ts';

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
  const route = useRoute();

  useEffect(() => { window.atlerLaunch?.step(0.85, 'Opening your data…'); }, []);
  useEffect(() => { if (data) window.atlerLaunch?.done(); }, [data]);
  if (!data) return null;

  const who = (session.user.user_metadata?.name as string | undefined) || session.user.email || 'You';
  const plan = route.name === 'plan' ? data.plans.find(p => p.id === route.id) : undefined;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32">
      <header className="flex items-center justify-between px-1 pt-2 pb-3">
        <div className="font-display text-xl leading-none font-bold tracking-[0.08em]">ATLER</div>
        <a href="#/you" aria-label={`You: ${who}`} className="flex size-[38px] items-center justify-center rounded-xl bg-block-2 font-extrabold text-ink no-underline">
          {who.charAt(0).toUpperCase()}
        </a>
      </header>

      <main>
        {route.name === 'plan' && plan ? <PlanDetails db={db} plan={plan} events={data.events.filter(e => e.planId === plan.id)} />
          : route.name === 'plans' ? <><h1 className="sr-only">Your plans</h1><Plans plans={data.plans} events={data.events} onAdd={() => setAdding(true)} /></>
          : route.name === 'you' ? <><h1 className="sr-only">You</h1><You db={db} session={session} /></>
          : <><h1 className="sr-only">Your month</h1><Month plans={data.plans} events={data.events} payments={data.payments} onAdd={() => setAdding(true)} /></>}
      </main>

      <nav aria-label="Main" className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-block-2 p-2">
        {([['#/', 'month', 'Month'], ['#/plans', 'plans', 'Plans'], ['#/you', 'you', 'You']] as const).map(([href, name, label]) => {
          const here = route.name === name;
          return (
            <a key={name} href={href} aria-current={here ? 'page' : undefined}
              className={`flex h-11 items-center rounded-full px-4 text-[13px] no-underline ${here ? 'bg-here font-extrabold text-on-color' : 'font-bold text-ink'}`}>
              {label}
            </a>
          );
        })}
        <button type="button" aria-label="Add a plan or expense" onClick={() => setAdding(true)} className="flex size-11 items-center justify-center rounded-full bg-money text-on-color">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </nav>

      <AddSheet db={db} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
