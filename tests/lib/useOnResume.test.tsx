import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOnResume } from '../../src/lib/useOnResume';

const setVisibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};

describe('useOnResume', () => {
  it('runs the callback when the app comes back to the foreground', () => {
    const cb = vi.fn();
    renderHook(() => useOnResume(cb));
    setVisibility('hidden');
    expect(cb).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('also runs when the network comes back', () => {
    const cb = vi.fn();
    renderHook(() => useOnResume(cb));
    act(() => window.dispatchEvent(new Event('online')));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unmount', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useOnResume(cb));
    unmount();
    setVisibility('visible');
    expect(cb).not.toHaveBeenCalled();
  });
});
