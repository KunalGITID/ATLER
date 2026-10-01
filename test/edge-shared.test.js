import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildShared, OUTPUT } from '../scripts/gen-edge-shared.mjs';

it('the Edge Function has the current date/reminder code (run node scripts/gen-edge-shared.mjs)', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(buildShared());
});
