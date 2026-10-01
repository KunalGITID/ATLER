// Tiny IndexedDB key/value store for data that must survive the app being
// closed offline (the outbox and the last loaded snapshot).
const DB_NAME = 'atler-data';
let dbPromise = null;

function open() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore('kv');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
}

function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
        const t = db.transaction('kv', mode);
        const result = fn(t.objectStore('kv'));
        t.oncomplete = () => resolve(result?.result);
        t.onerror = () => reject(t.error);
    }));
}

export const idbStore = {
    get: key => tx('readonly', s => s.get(key)).catch(() => undefined),
    set: (key, value) => tx('readwrite', s => s.put(value, key)).catch(() => {}),
    del: key => tx('readwrite', s => s.delete(key)).catch(() => {}),
};
