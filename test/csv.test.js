import { describe, expect, it } from 'vitest';
import { csvEscape, parseCsv, parseCsvRecords, toCsv } from '../src/lib/csv.js';

describe('csv', () => {
    it('quotes commas, quotes and newlines', () => {
        expect(csvEscape('a,b')).toBe('"a,b"');
        expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
        expect(csvEscape('two\nlines')).toBe('"two\nlines"');
        expect(csvEscape(null)).toBe('');
    });

    it('round-trips awkward values', () => {
        const rows = [{ name: 'Netflix, Premium', note: 'he said "ok"' }, { name: 'Spotify', note: 'line1\nline2' }];
        const headers = [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }];
        expect(parseCsvRecords(toCsv(rows, headers))).toEqual([
            { Name: 'Netflix, Premium', Note: 'he said "ok"' },
            { Name: 'Spotify', Note: 'line1\nline2' },
        ]);
    });

    it('handles CRLF line endings and skips blank lines', () => {
        expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('trims cells and fills missing columns with empty strings', () => {
        expect(parseCsvRecords(' Name , Price \n Netflix \n')).toEqual([{ Name: 'Netflix', Price: '' }]);
    });

    it('returns no records for a header-only file', () => {
        expect(parseCsvRecords('Name,Price\n')).toEqual([]);
    });
});
