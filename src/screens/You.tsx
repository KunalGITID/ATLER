import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AtlerDB } from '../data/db.ts';
import { supabase } from '../data/supabase.ts';
import { Block, Kicker } from '../ui/Block.tsx';
import { Button } from '../ui/Button.tsx';
import { ConfirmSheet } from './PlanSheets.tsx';

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

export function You({ db, session }: { db: AtlerDB; session: Session }) {
  const [erasing, setErasing] = useState(false);
  const name = (session.user.user_metadata?.name as string | undefined) ?? null;
  return (
    <div className="flex flex-col gap-2.5">
      <Block className="!p-4">
        <Kicker className="text-ink-2">Signed in as</Kicker>
        {name && <div className="mt-1 font-display text-2xl font-bold">{name}</div>}
        <div className="mt-0.5 truncate text-[15px] text-ink-2">{session.user.email}</div>
      </Block>

      <Block className="flex flex-col gap-2.5 !p-4">
        <Kicker className="text-ink-2">Your data</Kicker>
        <p className="text-sm text-ink-2">Everything is stored on this phone. A backup is one file with all your plans, their history and your expenses.</p>
        <Button kind="plain" onClick={() => exportBackup(db)}>Download a backup</Button>
      </Block>

      <Button kind="quiet" className="!h-14 !rounded-[20px]" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      <Button kind="danger" onClick={() => setErasing(true)}>Erase ATLER data on this phone</Button>
      <p className="px-2 text-center text-xs text-ink-2">ATLER v2 · {__APP_VERSION__}</p>

      <ConfirmSheet
        open={erasing}
        title="Erase everything on this phone?"
        body="All plans, their history and your expenses are deleted from this phone. Download a backup first if you might want them back."
        confirm="Erase it all"
        onConfirm={async () => { await db.delete(); location.hash = '#/'; location.reload(); }}
        onClose={() => setErasing(false)}
      />
    </div>
  );
}
