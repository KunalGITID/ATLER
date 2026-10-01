// Sends uncaught errors, unhandled promise rejections and failed saves to
// the error_log table. Capped per session and de-duplicated so a crash loop
// can't flood the table.
const MAX_PER_SESSION = 20;
const sent = new Set();
let count = 0;
let client = null;

const clip = (value, n) => (value == null ? null : String(value).slice(0, n));

export function reportError(kind, error, context = null) {
    if (!client || count >= MAX_PER_SESSION) return;
    const message = clip(error?.message || error || 'Unknown error', 1000);
    const key = `${kind}:${message}`;
    if (sent.has(key)) return;
    sent.add(key);
    count++;
    client.from('error_log').insert({
        kind,
        message,
        stack: clip(error?.stack, 4000),
        context,
        release: clip(__APP_RELEASE__, 40),
        url: clip(location.href.split('#')[0], 500),
        user_agent: clip(navigator.userAgent, 300),
    }).then(() => {}, () => {});
}

export function initErrorReporting(supabaseClient) {
    client = supabaseClient;
    window.addEventListener('error', e => reportError('error', e.error || e.message, {
        source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : null,
    }));
    window.addEventListener('unhandledrejection', e => reportError('rejection', e.reason));
}
