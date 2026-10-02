// Sends crashes and failed syncs to the error_log table (insert-only; nobody
// can read it through the API). At most 20 per session, duplicates dropped.
import { supabase } from './supabase.ts';

const MAX = 20;
const seen = new Set<string>();
const clip = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));

export function reportError(kind: 'error' | 'rejection' | 'write', error: unknown, context: Record<string, unknown> | null = null) {
  if (seen.size >= MAX) return;
  const err = error as { message?: string; stack?: string } | undefined;
  const message = clip(err?.message ?? error ?? 'Unknown error', 1000)!;
  const key = `${kind}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  void supabase.from('error_log').insert({
    kind,
    message,
    stack: clip(err?.stack, 4000),
    context: { app: 2, ...context },
    release: clip(__APP_VERSION__, 40),
    url: clip(location.href.split('#')[0], 500),
    user_agent: clip(navigator.userAgent, 300),
  }).then(() => {}, () => {});
}

export function startErrorReporting() {
  window.addEventListener('error', e => reportError('error', e.error ?? e.message, { source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : null }));
  window.addEventListener('unhandledrejection', e => reportError('rejection', e.reason));
}
