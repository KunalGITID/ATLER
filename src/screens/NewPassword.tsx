import { useState, type FormEvent } from 'react';
import { supabase } from '../data/supabase.ts';
import { Block } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';

// Shown when someone arrives from a password-reset email.
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    onDone();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-2.5 px-4 pt-[max(56px,env(safe-area-inset-top))]">
      <Block tone="money">
        <h1 className="font-display text-[32px] leading-none font-bold">Set a new password</h1>
        <p className="mt-2 text-[15px] font-bold">Then you’re straight back in.</p>
      </Block>
      <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
        <Block className="flex flex-col gap-3">
          <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          <Field label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </Block>
        {error && <p role="alert" className="text-center text-sm font-semibold text-danger">{error}</p>}
        <Button kind="primary" type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PASSWORD'}</Button>
      </form>
    </main>
  );
}
