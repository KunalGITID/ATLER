// Web Push subscription for renewal reminders. The matching private key is a
// secret on the send-reminders Edge Function, never in this repo.
export const VAPID_PUBLIC_KEY = 'BLrZ12Xv9qMlHSk2n_RZG3PclDDkV9X7g97Z5QF4u9xg6Hb60wuy6UFZDeogbp7Zi0rIarM_-GYRtWjHZpL4GYc';

export const pushSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64) {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// Resolves to null when there's no active service worker (dev server, or the
// worker hasn't installed yet) instead of waiting forever.
async function activeRegistration(timeoutMs = 5000) {
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);
}

// Returns { endpoint, p256dh, auth } for this device, subscribing if needed.
export async function getPushSubscription() {
    if (!pushSupported() || Notification.permission !== 'granted') return null;
    const reg = await activeRegistration();
    if (!reg) return null;
    const sub = await reg.pushManager.getSubscription()
        || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
    const { endpoint, keys } = sub.toJSON();
    return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export async function unsubscribePush() {
    if (!pushSupported()) return null;
    const reg = await activeRegistration(1000);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return null;
    const { endpoint } = sub;
    await sub.unsubscribe().catch(() => {});
    return endpoint;
}
