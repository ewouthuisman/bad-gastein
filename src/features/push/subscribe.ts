import { supabase } from '../../lib/supabase';

export type PushResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'error' };

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Asks for notification permission and stores this device's push subscription. */
export async function subscribePush(): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''),
      }));
    const json = sub.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
    return error ? { ok: false, reason: 'error' } : { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
