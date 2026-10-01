import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './data/supabase.ts';
import { SignIn } from './screens/SignIn.tsx';
import { Block } from './ui/Block.tsx';
import { Button } from './ui/Button.tsx';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    window.atlerLaunch?.step(0.6, 'Checking your session…');
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      window.atlerLaunch?.done();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // the launch screen is still up
  if (!session) return <SignIn />;

  // Signed in. The month screen is the next slice of the build.
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-2.5 px-4 pt-14">
      <Block tone="money">
        <h1 className="font-display text-3xl font-bold">ATLER v2</h1>
        <p className="mt-1 font-bold">Signed in as {session.user.email}</p>
      </Block>
      <Button kind="quiet" onClick={() => supabase.auth.signOut()}>Sign out</Button>
    </main>
  );
}
