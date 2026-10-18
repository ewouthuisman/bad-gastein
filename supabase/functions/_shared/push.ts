import webpush from 'npm:web-push@3.6.7';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { setting } from './supabase.ts';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

let configured = false;
async function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    (await setting('VAPID_SUBJECT')) ?? 'mailto:admin@example.com',
    (await setting('VAPID_PUBLIC_KEY'))!,
    (await setting('VAPID_PRIVATE_KEY'))!,
  );
  configured = true;
}

/** Sends a notification to every device of the given users; prunes expired subscriptions. */
export async function sendPush(db: SupabaseClient, userIds: string[] | 'all', payload: PushPayload): Promise<{ sent: number; failed: number }> {
  await configure();
  let q = db.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');
  if (userIds !== 'all') {
    if (!userIds.length) return { sent: 0, failed: 0 };
    q = q.in('user_id', userIds);
  }
  const { data: subs, error } = await q;
  if (error || !subs) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
        sent++;
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }),
  );
  return { sent, failed };
}
