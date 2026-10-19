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
