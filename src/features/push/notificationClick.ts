interface AppWindow {
  navigate(url: string): Promise<unknown>;
  focus(): Promise<unknown>;
}

/**
 * Brings the app to the front on the notification's page. navigate() rejects for windows the
 * service worker doesn't control yet, so every step falls back to the next one.
 */
export async function focusOrOpen(windows: AppWindow[], url: string, openWindow: (url: string) => Promise<unknown>): Promise<void> {
  const w = windows[0];
  if (w) {
    try {
      await w.navigate(url);
    } catch {
      /* uncontrolled window: focusing is still better than nothing */
    }
    try {
      await w.focus();
      return;
    } catch {
      /* fall through to a new window */
    }
  }
  await openWindow(url);
}
