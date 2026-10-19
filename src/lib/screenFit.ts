/**
 * iOS standalone PWAs can report a layout viewport shorter than the screen, leaving a dead band
 * under the tab bar. Stretch the app shell to the physical screen height in that case.
 */
export function fitToScreen() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  const apply = () => {
    const portrait = window.innerHeight >= window.innerWidth;
    const screenH = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
    const short = standalone && portrait && screenH - window.innerHeight > 20;
    document.documentElement.style.setProperty('--app-h', short ? `${screenH}px` : '');
    if (!short) document.documentElement.style.removeProperty('--app-h');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 300));
}

export function screenReport(): string {
  const vv = window.visualViewport;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return `inner ${window.innerWidth}x${window.innerHeight} · screen ${screen.width}x${screen.height} · vv ${Math.round(vv?.height ?? 0)} · inset-b ${inset} · standalone ${standalone}`;
}
