// Two-way sync between this phone's database and Supabase.
//   push: rows marked dirty -> upsert (the server keeps the newest edit)
//   pull: rows with a revision above what this phone has seen -> merge
import type { Table } from 'dexie';
import type { AtlerDB } from './db.ts';
import { supabase } from './supabase.ts';
import { keepLocal, tables, type Remote } from './syncMap.ts';

type Key = keyof typeof tables;
const KEYS: Key[] = ['categories', 'plans', 'events', 'payments'];
const PAGE = 500;

type Row = { id: string; updatedAt: number; dirty?: 1 };
const tableOf = (db: AtlerDB, key: Key) => db[key] as unknown as Table<Row, string>;

async function push(db: AtlerDB, key: Key, userId: string): Promise<number> {
  const table = tableOf(db, key);
  const rows = await table.where('dirty').equals(1).toArray();
  if (!rows.length) return 0;
  const toRemote = tables[key].toRemote as (r: Row, u: string) => object;
  for (let i = 0; i < rows.length; i += PAGE) {
    const chunk = rows.slice(i, i + PAGE);
    const { error } = await supabase.from(tables[key].remote).upsert(chunk.map(r => toRemote(r, userId)), { onConflict: 'id' });
    if (error) throw error;
  }
  // Clear the flag only where nothing changed since we read the row.
  const sentAt = new Map(rows.map(r => [r.id, r.updatedAt]));
  await table.where('id').anyOf([...sentAt.keys()]).modify(r => {
    if (sentAt.get(r.id) === r.updatedAt) delete r.dirty;
  });
  return rows.length;
}

async function pull(db: AtlerDB, key: Key): Promise<number> {
  const table = tableOf(db, key);
  const cursorKey = `rev:${key}`;
  let cursor = (await db.meta.get(cursorKey))?.value ?? 0;
  let pulled = 0;
  for (;;) {
    const { data, error } = await supabase.from(tables[key].remote).select('*').gt('revision', cursor).order('revision').limit(PAGE);
    if (error) throw error;
    const rows = (data ?? []) as Remote[];
    if (!rows.length) break;
    const fromRemote = tables[key].fromRemote as (r: Remote) => Row;
    await db.transaction('rw', table, db.meta, async () => {
      const locals = await table.bulkGet(rows.map(r => r.id));
      const incoming = rows.filter((r, i) => !keepLocal(locals[i], r)).map(fromRemote);
      if (incoming.length) await table.bulkPut(incoming);
      cursor = Math.max(cursor, ...rows.map(r => Number(r.revision)));
      await db.meta.put({ key: cursorKey, value: cursor });
    });
    pulled += rows.length;
    if (rows.length < PAGE) break;
  }
  return pulled;
}

export async function syncOnce(db: AtlerDB, userId: string) {
  let pushed = 0;
  let pulled = 0;
  for (const key of KEYS) pushed += await push(db, key, userId);
  for (const key of KEYS) pulled += await pull(db, key);
  return { pushed, pulled };
}

export async function waitingCount(db: AtlerDB): Promise<number> {
  const counts = await Promise.all(KEYS.map(k => tableOf(db, k).where('dirty').equals(1).count()));
  return counts.reduce((a, b) => a + b, 0);
}
