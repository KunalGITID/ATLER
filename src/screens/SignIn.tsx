import { useState, type FormEvent } from 'react';
import { supabase } from '../data/supabase.ts';
import { Block } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Segmented } from '../ui/Segmented.tsx';

type Mode = 'signin' | 'signup';

const appUrl = () => `${location.origin}${location.pathname}`;

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!email.trim() || !password) return setMessage({ kind: 'error', text: 'Enter your email and password.' });
    if (mode === 'signup' && !name.trim()) return setMessage({ kind: 'error', text: 'Enter your name.' });
    setBusy(true);
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() }, emailRedirectTo: appUrl() } });
    setBusy(false);
    if (error) return setMessage({ kind: 'error', text: error.message });
    if (mode === 'signup' && !data.session) setMessage({ kind: 'info', text: 'Check your email to confirm your account, then sign in.' });
  }

  async function forgot() {
    setMessage(null);
    if (!email.trim()) return setMessage({ kind: 'error', text: 'Enter your email first.' });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Password reset email sent.' });
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
    if (error) setMessage({ kind: 'error', text: error.message });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-2.5 px-4 pt-[max(56px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <Block tone="money">
        <h1 className="font-display text-[42px] leading-none font-bold tracking-[0.04em]">ATLER</h1>
        <p className="mt-2 text-[15px] font-bold">See your month before it happens.</p>
      </Block>

      <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
        <Block className="flex flex-col gap-3">
          <Segmented
            label="Sign in or create an account"
            value={mode}
            onChange={m => { setMode(m); setMessage(null); }}
            options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'New account' }]}
          />
          {mode === 'signup' && <Field label="Name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />}
          <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          <Field label="Password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />
          {mode === 'signin' && (
            <button type="button" onClick={forgot} className="self-end text-[13px] font-bold text-ink">Forgot password?</button>
          )}
        </Block>

        <Button kind="primary" type="submit" disabled={busy}>
          {busy ? 'ONE MOMENT…' : mode === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
        </Button>
        <Button kind="plain" onClick={google}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"/></svg>
          Continue with Google
        </Button>
      </form>

      <p role={message?.kind === 'error' ? 'alert' : 'status'} className={`min-h-5 text-center text-sm font-semibold ${message?.kind === 'error' ? 'text-danger' : 'text-money'}`}>
        {message?.text}
      </p>
      <p className="mt-auto text-center text-xs text-ink-2">Statements and SMS you import never leave your phone.</p>
    </main>
  );
}
