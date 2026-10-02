import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { dbFor, readAll } from './data/db.ts';
import { supabase } from './data/supabase.ts';
import { AddSheet } from './screens/AddSheet.tsx';
import { Month } from './screens/Month.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { NewPassword } from './screens/NewPassword.tsx';
import { PlanDetails } from './screens/PlanDetails.tsx';
import { Plans } from './screens/Plans.tsx';
import { You } from './screens/You.tsx';
import { goBack, useRoute } from './route.ts';
import { useSwipe } from './ui/useSwipe.ts';
import { useSync } from './data/useSync.ts';
import { usePush } from './data/usePush.ts';
import { Panel } from './ui/Sheet.tsx';
import { Avatar } from './ui/Avatar.tsx';
import { avatarUrl } from './data/avatar.ts';
import { ToastProvider } from './ui/Toast.tsx';
import { Spent } from './screens/Spent.tsx';
import { Calendar } from './screens/Calendar.tsx';
import { Year } from './screens/Year.tsx';
// Opened now and then: loaded when first opened.
const MoneyPanel = lazy(() => import('./screens/MoneyPanel.tsx').then(m => ({ default: m.MoneyPanel })));
const Ask = lazy(() => import('./screens/Ask.tsx').then(m => ({ default: m.Ask })));
import { monthOf } from './core/spent.ts';
import { today as todayDay } from './core/dates.ts';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    window.atlerLaunch?.step(0.6, 'Checking your session…');
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) window.atlerLaunch?.done();
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') { setRecovering(true); window.atlerLaunch?.done(); }
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (recovering) return <NewPassword onDone={() => { setRecovering(false); location.hash = '#/'; }} />;
  if (session === undefined) return null; // the launch screen is still up
  if (!session) return <SignIn />;
  return <ToastProvider><SignedIn session={session} /></ToastProvider>;
}

function SignedIn({ session }: { session: Session }) {
  const db = useMemo(() => dbFor(session.user.id), [session.user.id]);
  const data = useLiveQuery(() => readAll(db), [db]);
  const sync = useSync(db, session.user.id);
  const push = usePush(session.user.id);
  const [adding, setAdding] = useState(false);
  const [addAs, setAddAs] = useState<'plan' | 'expense' | undefined>(undefined);
  // Home-screen shortcuts open the app as ./?do=add-expense or ./?do=add-plan.
  useEffect(() => {
    const action = new URLSearchParams(location.search).get('do');
    if (action !== 'add-expense' && action !== 'add-plan') return;
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
    setAddAs(action === 'add-plan' ? 'plan' : 'expense');
    setAdding(true);
  }, []);
  const [gaveUp, setGaveUp] = useState(false);
  const route = useRoute();
  // Swipe between the two tabs; a plan swipes back to where it was opened from.
  const swipe = useSwipe({
    left: () => { if (route.name === 'month') location.hash = '#/plans'; },
    right: () => {
      if (route.name === 'plans') location.hash = '#/';
      else if (route.name === 'plan') goBack();
    },
  });

  // A phone with nothing on it yet waits for the first sync (up to 8 s), so a
  // returning user sees their month instead of an empty one.
  const empty = !!data && !data.plans.length && !data.payments.length && !data.categories.length;
  const ready = !!data && (!empty || sync.firstDone || gaveUp);

  useEffect(() => { window.atlerLaunch?.step(0.75, 'Opening your data…'); }, []);
  useEffect(() => {
    if (!data) return;
    if (!ready) {
      window.atlerLaunch?.step(0.9, 'Syncing your month…');
      const t = setTimeout(() => setGaveUp(true), 8000);
      return () => clearTimeout(t);
    }
    window.atlerLaunch?.done();
  }, [data, ready]);
  if (!data || !ready) return null;

  const who = (session.user.user_metadata?.name as string | undefined) || session.user.email || 'You';
  // Panels float over the home screen; closing one goes home without
  // leaving a history entry to come back to.
  const closePanel = () => location.replace(`${location.pathname}${location.search}#/`);
  const plan = route.name === 'plan' ? data.plans.find(p => p.id === route.id) : undefined;

  return (
    <div ref={swipe} className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-32">
      <header className="flex items-center justify-between px-1 pt-2 pb-3">
        <div className="font-display text-xl leading-none font-bold tracking-[0.08em]">ATLER</div>
        <a href="#/you" aria-label={`You: ${who}`} aria-current={route.name === 'you' ? 'page' : undefined}
          className={`rounded-xl no-underline ${route.name === 'you' ? 'ring-2 ring-here ring-offset-2 ring-offset-ground' : ''}`}>
          <Avatar url={avatarUrl(session.user)} name={who} size={38} className={`rounded-xl ${route.name === 'you' ? 'bg-here text-on-color' : 'bg-block-2 text-ink'}`} />
        </a>
      </header>

      <main>
        {route.name === 'plan' && plan ? <PlanDetails db={db} plan={plan} events={data.events.filter(e => e.planId === plan.id)} categories={data.categories} push={push.state} onEnablePush={push.turnOn} />
          : route.name === 'plans' ? <><h1 className="sr-only">Your plans</h1><Plans plans={data.plans} events={data.events} onAdd={() => setAdding(true)} /></>
          : route.name === 'you' ? <><h1 className="sr-only">You</h1><You db={db} session={session} categories={data.categories} plans={data.plans} events={data.events} payments={data.payments} sync={sync} push={push.state} onPush={on => void (on ? push.turnOn() : push.turnOff())} /></>
          : <><h1 className="sr-only">Your month</h1><Month db={db} plans={data.plans} events={data.events} payments={data.payments} categories={data.categories} incomes={data.incomes} onAdd={() => setAdding(true)} /></>}
      </main>

      {route.name === 'spent' && <Panel title="What I spent" onClose={closePanel}><Spent db={db} month={monthOf(route.month, todayDay())} plans={data.plans} events={data.events} payments={data.payments} categories={data.categories} /></Panel>}
      {route.name === 'calendar' && <Panel title="Calendar" onClose={closePanel}><Calendar month={monthOf(route.month, todayDay())} plans={data.plans} events={data.events} payments={data.payments} /></Panel>}
      {route.name === 'money' && <Panel title="Income & goals" onClose={closePanel}><Suspense fallback={null}><MoneyPanel db={db} incomes={data.incomes} goals={data.goals} plans={data.plans} events={data.events} payments={data.payments} /></Suspense></Panel>}
      {route.name === 'ask' && <Panel title="Ask about your money" onClose={closePanel}><Suspense fallback={null}><Ask data={data} /></Suspense></Panel>}
      {route.name === 'year' && <Panel title="Year in review" onClose={closePanel}><Year year={Number(route.year ?? todayDay().slice(0, 4))} plans={data.plans} events={data.events} payments={data.payments} categories={data.categories} /></Panel>}

      <nav aria-label="Main" className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-block-2 p-2">
        {([['#/', 'month', 'Month'], ['#/plans', 'plans', 'Plans']] as const).map(([href, name, label]) => {
          const here = route.name === name || (name === 'month' && ['spent', 'calendar', 'year', 'money', 'ask'].includes(route.name));
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

      <AddSheet db={db} categories={data.categories} plans={data.plans} payments={data.payments} open={adding} startAs={addAs} onClose={() => { setAdding(false); setAddAs(undefined); }} onTrialAdded={() => { if (push.state === 'off') void push.turnOn(); }} />
    </div>
  );
}
