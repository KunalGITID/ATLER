import { describe, expect, it } from 'vitest';
import { BackupError, isLocked, lock, readBackup } from './backup.ts';

const backup = JSON.stringify({ app: 'atler', version: 2, exportedAt: 'x', plans: [{ id: 'a', name: 'Netflix' }], events: [], payments: [], categories: [] });

describe('backups', () => {
  it('a password-locked backup opens with the right password only', async () => {
    const locked = await lock(backup, 'correct horse');
    expect(locked).not.toContain('Netflix');
    expect(isLocked(JSON.parse(locked))).toBe(true);
    expect((await readBackup(locked, 'correct horse')).plans[0]).toMatchObject({ name: 'Netflix' });
    await expect(readBackup(locked, 'wrong')).rejects.toThrow('doesn’t open');
    await expect(readBackup(locked)).rejects.toThrow('locked with a password');
  });
  it('plain backups read as they are; older ones gain empty income and goals', async () => {
    expect(await readBackup(backup)).toMatchObject({ incomes: [], goals: [] });
  });
  it('anything else is refused', async () => {
    await expect(readBackup('{"app":"other"}')).rejects.toBeInstanceOf(BackupError);
    await expect(readBackup('not json')).rejects.toBeInstanceOf(BackupError);
  });
});
