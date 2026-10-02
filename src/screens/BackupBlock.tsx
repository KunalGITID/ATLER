import { useRef, useState, type FormEvent } from 'react';
import { BackupError, buildBackup, lock, readBackup, restoreBackup, type Backup } from '../data/backup.ts';
import type { AtlerDB } from '../data/db.ts';
import { Button } from '../ui/Button.tsx';
import { Field } from '../ui/Field.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const stamp = () => new Date().toISOString().slice(0, 10);

// Download a backup (plain or locked with a password) and restore one.
export function BackupButtons({ db, download }: { db: AtlerDB; download: (text: string, name: string, type: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [locking, setLocking] = useState(false);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<{ text: string; wrong: boolean } | null>(null);
  const [ready, setReady] = useState<Backup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadLocked(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== again) return setError('The two passwords don’t match.');
    const text = await lock(JSON.stringify(await buildBackup(db)), password);
    download(text, `atler-backup-${stamp()}-locked.json`, 'application/json');
    setLocking(false); setPassword(''); setAgain(''); setError('');
  }

  async function open(text: string, pw?: string) {
    setMessage(null);
    try {
      setReady(await readBackup(text, pw));
      setOpening(null);
      setPassword('');
    } catch (e) {
      if (e instanceof BackupError && /locked/.test(e.message)) return setOpening({ text, wrong: false });
      if (e instanceof BackupError && /doesn’t open/.test(e.message)) return setOpening({ text, wrong: true });
      setMessage((e as Error).message);
    }
  }

  const count = ready ? ready.plans.length + ready.payments.length + ready.categories.length + (ready.incomes?.length ?? 0) + (ready.goals?.length ?? 0) : 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button kind="quiet" onClick={() => { setError(''); setLocking(true); }}>Locked backup</Button>
        <Button kind="quiet" onClick={() => input.current?.click()}>Restore a backup</Button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Backup file"
        onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(await f.text()); }} />
      {message && <p role="status" className="text-sm font-bold">{message}</p>}

      <Sheet open={locking} onClose={() => setLocking(false)} title="Lock the backup">
        <form className="flex flex-col gap-3" onSubmit={downloadLocked} noValidate>
          <h2 className="font-display text-2xl font-bold">Lock the backup</h2>
          <p className="text-sm text-ink-2">Encrypted on this phone. Without the password nobody can read it, and neither can ATLER: there is no way to recover it.</p>
          <Field label="Password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          <Field label="Same password again" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          <Button kind="primary" type="submit">DOWNLOAD</Button>
        </form>
      </Sheet>

      <Sheet open={opening !== null} onClose={() => setOpening(null)} title="Backup password">
        <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (opening && password) void open(opening.text, password); }}>
          <h2 className="font-display text-2xl font-bold">Backup password</h2>
          {opening?.wrong && <p role="alert" className="text-sm font-semibold text-danger">That password doesn’t open this backup.</p>}
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <Button kind="primary" type="submit">OPEN</Button>
        </form>
      </Sheet>

      <Sheet open={ready !== null} onClose={() => setReady(null)} title="Restore this backup?">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">Restore this backup?</h2>
          <p className="text-[15px] text-ink-2">
            {ready ? `${ready.plans.length} plans, ${ready.payments.length} expenses, ${ready.categories.length} categories${ready.incomes?.length ? `, ${ready.incomes.length} incomes` : ''}${ready.goals?.length ? `, ${ready.goals.length} goals` : ''}` : ''}
            {ready ? ` from ${ready.exportedAt.slice(0, 10)}. ` : ''}Items also on this phone are replaced by the backup's copy; nothing else is removed. They sync to your account.
          </p>
          <Button kind="plain" onClick={() => setReady(null)}>Not now</Button>
          <Button kind="primary" onClick={async () => {
            const n = await restoreBackup(db, ready!);
            setReady(null);
            setMessage(`Restored ${n} item${n === 1 ? '' : 's'}.`);
          }}>RESTORE {count}</Button>
        </div>
      </Sheet>
    </>
  );
}
