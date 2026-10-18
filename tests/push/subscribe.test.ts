import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn((_row: Record<string, unknown>) => Promise.resolve({ error: null }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: () => ({ upsert }) } }));

import { subscribePush } from '../../src/features/push/subscribe';

const g = globalThis as unknown as Record<string, unknown>;
const subscription = { toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }) };

function installPushApis(permission: NotificationPermission) {
  g.PushManager = function PushManager() {};
  g.Notification = { requestPermission: vi.fn(() => Promise.resolve(permission)), permission: 'default' };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve({ pushManager: { subscribe: vi.fn(() => Promise.resolve(subscription)), getSubscription: () => Promise.resolve(null) } }) },
    configurable: true,
  });
}

describe('subscribePush', () => {
  beforeEach(() => upsert.mockClear());
  afterEach(() => {
    delete g.PushManager;
    delete g.Notification;
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('reports unsupported when Push or Notification is missing (iPhone not on home screen)', async () => {
    expect(await subscribePush()).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('reports denied when the user refuses', async () => {
    installPushApis('denied');
    expect(await subscribePush()).toEqual({ ok: false, reason: 'denied' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stores the subscription keys on success', async () => {
    installPushApis('granted');
    expect(await subscribePush()).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith({ endpoint: 'https://push.example/abc', p256dh: 'P', auth: 'A' });
  });
});
