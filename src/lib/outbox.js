// Writes made while offline are kept, in order, and replayed when the
// connection is back. A write is a plain object (so it can be stored):
//   { table, op: 'insert'|'upsert'|'update'|'delete', values?, options?, match?, in? }

export function isNetworkError(error) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const text = `${error?.name || ''} ${error?.message || error || ''}`;
    return /Failed to fetch|NetworkError|Load failed|network|AuthRetryableFetchError|ERR_INTERNET|timed? ?out/i.test(text);
}

// Runs one stored write against a supabase-js client. Returns { error }.
export async function runWrite(client, w) {
    let q = client.from(w.table);
    if (w.op === 'insert') q = q.insert(w.values);
    else if (w.op === 'upsert') q = q.upsert(w.values, w.options);
    else if (w.op === 'update') q = q.update(w.values);
    else if (w.op === 'delete') q = q.delete();
    else return { error: new Error(`unknown write ${w.op}`) };
    for (const [col, value] of Object.entries(w.match || {})) q = q.eq(col, value);
    if (w.in) q = q.in(w.in[0], w.in[1]);
    try {
        const { error } = await q;
        return { error: error || null };
    } catch (error) {
        return { error };
    }
}

// store: { get, set } (async). key: per-user storage key.
export function createOutbox({ store, run, onDropped = () => {} }) {
    let key = null;
    let queue = [];
    let flushing = null;

    const save = () => key && store.set(key, queue);

    return {
        async use(newKey) {
            key = newKey;
            queue = (newKey && (await store.get(newKey))) || [];
        },
        get size() {
            return queue.length;
        },
        async add(writes) {
            queue.push(...writes);
            await save();
        },
        // Replays queued writes in order. Stops at the first network failure
        // (still offline); drops a write the server rejects outright.
        // Resolves to { sent, dropped, remaining }.
        flush() {
            if (flushing) return flushing;
            flushing = (async () => {
                let sent = 0;
                let dropped = 0;
                while (queue.length) {
                    const { error } = await run(queue[0]);
                    if (error && isNetworkError(error)) break;
                    const [w] = queue.splice(0, 1);
                    if (error) {
                        dropped++;
                        onDropped(w, error);
                    } else {
                        sent++;
                    }
                    await save();
                }
                return { sent, dropped, remaining: queue.length };
            })().finally(() => { flushing = null; });
            return flushing;
        },
    };
}
