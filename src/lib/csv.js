// CSV export/import helpers (RFC 4180 quoting).

export function csvEscape(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function toCsv(rows, headers) {
    const headerLine = headers.map(col => csvEscape(col.label)).join(',');
    const lines = rows.map(row => headers.map(col => csvEscape(row[col.key])).join(','));
    return [headerLine, ...lines].join('\n');
}

export function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                value += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(value);
            if (row.some(cell => cell !== '')) rows.push(row);
            row = [];
            value = '';
        } else {
            value += char;
        }
    }

    if (value !== '' || row.length) {
        row.push(value);
        if (row.some(cell => cell !== '')) rows.push(row);
    }
    return rows;
}

export function parseCsvRecords(text) {
    const rows = parseCsv(text.trim());
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => String(h).trim());
    return rows.slice(1)
        .filter(row => row.some(cell => String(cell).trim() !== ''))
        .map(row => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = row[index] != null ? String(row[index]).trim() : '';
            });
            return record;
        });
}
