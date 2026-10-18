import { describe, expect, it, vi } from 'vitest';
import { focusOrOpen } from '../../src/features/push/notificationClick';

describe('focusOrOpen', () => {
  it('navigates and focuses an open app window', async () => {
    const w = { navigate: vi.fn().mockResolvedValue(undefined), focus: vi.fn().mockResolvedValue('w') };
    const openWindow = vi.fn();
    await focusOrOpen([w], 'https://app/#/kaart', openWindow);
    expect(w.navigate).toHaveBeenCalledWith('https://app/#/kaart');
    expect(w.focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('still focuses when navigate fails (uncontrolled window)', async () => {
    const w = { navigate: vi.fn().mockRejectedValue(new TypeError('not controlled')), focus: vi.fn().mockResolvedValue('w') };
    const openWindow = vi.fn();
    await focusOrOpen([w], 'https://app/#/kaart', openWindow);
    expect(w.focus).toHaveBeenCalled();
  });

  it('opens a new window when focusing fails too', async () => {
    const w = { navigate: vi.fn().mockRejectedValue(new Error('x')), focus: vi.fn().mockRejectedValue(new Error('y')) };
    const openWindow = vi.fn().mockResolvedValue(null);
    await focusOrOpen([w], 'https://app/#/kaart', openWindow);
    expect(openWindow).toHaveBeenCalledWith('https://app/#/kaart');
  });

  it('opens a window when the app is not open', async () => {
    const openWindow = vi.fn().mockResolvedValue(null);
    await focusOrOpen([], 'https://app/#/planning', openWindow);
    expect(openWindow).toHaveBeenCalledWith('https://app/#/planning');
  });
});
