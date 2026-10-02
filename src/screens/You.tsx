import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AtlerDB } from '../data/db.ts';
import { supabase } from '../data/supabase.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmSheet } from './PlanSheets.tsx';
import { Categories } from './Categories.tsx';
import type { Category } from '../core/model.ts';
import type { SyncState } from '../data/useSync.ts';

async function exportBackup(db: AtlerDB) {
  const [plans, events, payments, categories] = await Promise.all([db.plans.toArray(), db.events.toArray(), db.payments.toArray(), db.categories.toArray()]);
  const live = <T extends { deleted?: 1 }>(rows: T[]) => rows.filter(r => !r.deleted);
  const backup = { app: 'atler', version: 2, exportedAt: new Date().toISOString(), plans: live(plans), events: live(events), payments: live(payments), categories: live(categories) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `atler-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function You({ db, session, categories, sync }: { db: AtlerDB; session: Session; categories: Category[]; sync: SyncState }) {
  const [erasing, setErasing] = useState(false);
  const name = (session.user.user_metadata?.name as string | undefined) ?? null;
  return (
    <div className="flex flex-col gap-2.5">
      <Block className="!p-4">
        <Kicker className="text-ink-2">Signed in as</Kicker>
        {name && <div className="mt-1 font-display text-2xl font-bold">{name}</div>}
        <div className="mt-0.5 truncate text-[15px] text-ink-2">{session.user.email}</div>
      </Block>

      <Categories db={db} categories={categories} />

      <Block className="flex flex-col gap-2.5 !p-4">
        <Kicker className="text-ink-2">Your data</Kicker>
        <SyncLine sync={sync} />
        <p className="text-sm text-ink-2">Stored on this phone and synced to your account, so every device you sign in on shows the same month. A backup is one file with everything.</p>
        <Button kind="plain" onClick={() => exportBackup(db)}>Download a backup</Button>
      </Block>

      <Button kind="quiet" className="!h-14 !rounded-[20px]" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      <Button kind="danger" onClick={() => setErasing(true)}>Erase ATLER data on this phone</Button>
      <p className="px-2 text-center text-xs text-ink-2">ATLER v2 · {__APP_VERSION__}</p>

      <ConfirmSheet
        open={erasing}
        title="Erase everything on this phone?"
        body={sync.waiting > 0
          ? `${sync.waiting} change${sync.waiting > 1 ? 's haven’t' : ' hasn’t'} reached your account yet and would be lost. Your synced data stays in your account and comes back when you sign in again.`
          : 'This only clears this phone. Your synced data stays in your account and comes back when you sign in again.'}
        confirm="Erase it all"
        onConfirm={async () => { await db.delete(); location.hash = '#/'; location.reload(); }}
        onClose={() => setErasing(false)}
      />
    </div>
  );
}

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

// One line, one meaning: is what's on this phone also in your account?
function SyncLine({ sync }: { sync: SyncState }) {
  const waiting = sync.waiting > 0 ? ` · ${sync.waiting} change${sync.waiting > 1 ? 's' : ''} waiting` : '';
  const [dot, text] =
    sync.status === 'syncing' ? ['bg-ink-2', 'Syncing…']
    : sync.status === 'offline' ? ['bg-soon', `Offline${waiting || ' · nothing waiting'}`]
    : sync.status === 'error' ? ['bg-danger', `Couldn't sync${waiting}`]
    : ['bg-money', `Synced ${sync.lastSynced ? ago(sync.lastSynced) : ''}${waiting}`];
  return (
    <div role="status" className="flex items-center gap-2 text-sm font-bold">
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </div>
  );
}
