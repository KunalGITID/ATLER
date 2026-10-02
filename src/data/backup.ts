// Backups: one JSON file with everything, optionally locked with a password
// (AES-GCM, key from PBKDF2-SHA-256), and restoring one into this phone.
// Encryption happens on the phone; the password is never stored or sent.
import type { Category, Goal, Income, Payment, Plan, PlanEvent } from '../core/model.ts';
import type { AtlerDB } from './db.ts';
import { touched } from './touch.ts';

export interface Backup {
  app: 'atler';
  version: 2;
  exportedAt: string;
  plans: Plan[];
  events: PlanEvent[];
  payments: Payment[];
  categories: Category[];
  incomes?: Income[];
  goals?: Goal[];
}

interface Locked { app: 'atler'; encrypted: 1; kdf: 'PBKDF2-SHA256'; iterations: number; salt: string; iv: string; data: string }

const ITERATIONS = 310_000;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFrom(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export class BackupError extends Error {}

export async function lock(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  const locked: Locked = { app: 'atler', encrypted: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) };
  return JSON.stringify(locked);
}

export const isLocked = (parsed: unknown): parsed is Locked => !!parsed && typeof parsed === 'object' && (parsed as Locked).encrypted === 1;

export async function unlock(locked: Locked, password: string): Promise<string> {
  const key = await keyFrom(password, unb64(locked.salt), locked.iterations);
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(locked.iv) }, key, unb64(locked.data)));
  } catch {
    throw new BackupError('That password doesn’t open this backup.');
  }
}

// A backup file's text -> its contents. Asks for the password via `password`
// when the file is locked; throws BackupError for anything that isn't ATLER's.
export async function readBackup(text: string, password?: string): Promise<Backup> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new BackupError('That file isn’t an ATLER backup.'); }
  if (isLocked(parsed)) {
    if (!password) throw new BackupError('This backup is locked with a password.');
    return readBackup(await unlock(parsed, password));
  }
  const b = parsed as Partial<Backup>;
  if (b?.app !== 'atler' || b.version !== 2 || !Array.isArray(b.plans) || !Array.isArray(b.payments)) throw new BackupError('That file isn’t an ATLER backup.');
  return { ...b, events: b.events ?? [], categories: b.categories ?? [], incomes: b.incomes ?? [], goals: b.goals ?? [] } as Backup;
}

const strip = <T extends object>(row: T) => {
  const { updatedAt: _u, dirty: _d, deleted: _x, ...rest } = row as T & { updatedAt?: number; dirty?: 1; deleted?: 1 };
  return rest as T;
};

export async function buildBackup(db: AtlerDB): Promise<Backup> {
  const live = <T extends { deleted?: 1 }>(rows: T[]) => rows.filter(r => !r.deleted).map(strip);
  const [plans, events, payments, categories, incomes, goals] = await Promise.all([
    db.plans.toArray(), db.events.toArray(), db.payments.toArray(), db.categories.toArray(), db.incomes.toArray(), db.goals.toArray(),
  ]);
  return { app: 'atler', version: 2, exportedAt: new Date().toISOString(), plans: live(plans), events: live(events), payments: live(payments), categories: live(categories), incomes: live(incomes), goals: live(goals) };
}

// Put a backup's rows on this phone (and from here, into your account).
// Rows with the same id are replaced by the backup's copy; nothing else is removed.
export async function restoreBackup(db: AtlerDB, b: Backup): Promise<number> {
  const stamp = () => touched();
  let count = 0;
  await db.transaction('rw', [db.plans, db.events, db.payments, db.categories, db.incomes, db.goals], async () => {
    const put = async <T extends { id: string }>(table: { bulkPut: (rows: Array<T & { updatedAt: number; dirty: 1 }>) => Promise<unknown> }, rows: T[] | undefined) => {
      const list = (rows ?? []).filter(r => r && typeof r.id === 'string').map(r => ({ ...strip(r), ...stamp() }));
      if (list.length) await table.bulkPut(list);
      count += list.length;
    };
    await put(db.categories, b.categories);
    await put(db.plans, b.plans);
    await put(db.events, b.events);
    await put(db.payments, b.payments);
    await put(db.incomes, b.incomes);
    await put(db.goals, b.goals);
  });
  return count;
}
