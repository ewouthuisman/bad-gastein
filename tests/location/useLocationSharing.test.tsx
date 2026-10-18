import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn((_row: Record<string, unknown>) => Promise.resolve({ error: null }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: () => ({ upsert }) } }));

import { useLocationSharing } from '../../src/features/location/useLocationSharing';
import { AuthContext, type AuthState } from '../../src/auth/AuthProvider';

const auth = { session: { user: { id: 'u1' } }, profile: null, isAdmin: false, loading: false, refreshProfile: async () => {} } as unknown as AuthState;
const wrapper = ({ children }: { children: ReactNode }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;

let onFix: ((p: GeolocationPosition) => void) | null = null;
const watchPosition = vi.fn((cb: (p: GeolocationPosition) => void) => {
  onFix = cb;
  return 7;
});
const clearWatch = vi.fn();
const fix = (lat: number, lng: number) =>
  act(() => onFix!({ coords: { latitude: lat, longitude: lng, accuracy: 8 }, timestamp: Date.now() } as GeolocationPosition));
const setVisibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};

// 0.000234° latitude ≈ 26 m; 0.00009° ≈ 10 m
describe('useLocationSharing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    upsert.mockClear();
    watchPosition.mockClear();
    clearWatch.mockClear();
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() }, configurable: true });
    setVisibility('visible');
  });
  afterEach(() => vi.useRealTimers());

  it('sends the first fix', () => {
    renderHook(() => useLocationSharing(), { wrapper });
    fix(47.1, 13.1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', lat: 47.1, lng: 13.1, accuracy_m: 8 });
  });

  it('skips small moves within 30 s and sends moves over 25 m', () => {
    renderHook(() => useLocationSharing(), { wrapper });
    fix(47.1, 13.1);
    act(() => vi.advanceTimersByTime(10_000));
    fix(47.10009, 13.1);
    expect(upsert).toHaveBeenCalledTimes(1);
    fix(47.100234, 13.1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('refreshes the timestamp every 30 s while standing still', () => {
    renderHook(() => useLocationSharing(), { wrapper });
    fix(47.1, 13.1);
    act(() => vi.advanceTimersByTime(30_000));
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('stops watching when hidden and resumes when visible', () => {
    renderHook(() => useLocationSharing(), { wrapper });
    expect(watchPosition).toHaveBeenCalledTimes(1);
    setVisibility('hidden');
    expect(clearWatch).toHaveBeenCalledWith(7);
    setVisibility('visible');
    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it('exposes the latest position', () => {
    const { result } = renderHook(() => useLocationSharing(), { wrapper });
    fix(47.2, 13.2);
    expect(result.current.position).toMatchObject({ lat: 47.2, lng: 13.2 });
  });
});
