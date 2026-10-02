// Web Push for renewal reminders. The private key lives only as a secret on
// the send-reminders-v2 Edge Function.
import { supabase } from './supabase.ts';

export const VAPID_PUBLIC_KEY = 'BLrZ12Xv9qMlHSk2n_RZG3PclDDkV9X7g97Z5QF4u9xg6Hb60wuy6UFZDeogbp7Zi0rIarM_-GYRtWjHZpL4GYc';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

async function registration(timeoutMs = 4000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await registration(1500);
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

// Ask (only from a tap), subscribe this device and register it for v2.
export async function enablePush(userId: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  if (!reg) return 'off';
  const sub = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint, p256dh: keys.p256dh, auth: keys.auth, user_id: userId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', app: 2,
  });
  if (error) throw error;
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration(1500);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
}
