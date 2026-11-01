/* Keep site buttons away from the provider's map controls and attribution. */
(() => {
  const map = document.querySelector('.map-wrap');
  if (!map) return;
  const buttons = [...document.querySelectorAll('.floating-reserve,.theme-toggle')];
  const music = document.querySelector('.music-control');
  const toggle = document.querySelector('#music-toggle');
  let near = false, queued = false;
  const intersects = (a,b) => a.width > 0 && a.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const resetDock = () => { music?.classList.remove('map-safe-dock'); music?.style.removeProperty('--map-music-top'); };
  const update = () => {
    if (!near) { buttons.forEach(b => b.classList.remove('map-control-hidden')); resetDock(); return; }
    const bounds = map.getBoundingClientRect();
    buttons.forEach(b => b.classList.toggle('map-control-hidden', intersects(b.getBoundingClientRect(),bounds)));
    resetDock();
    if (!music?.classList.contains('music-on')) return;
    const sound = music.getBoundingClientRect();
    if (!intersects(sound,bounds)) return;
    const height = window.visualViewport?.height || innerHeight;
    const above = bounds.top, below = height - bounds.bottom;
    let top;
    if (above >= sound.height + 12) top = Math.min(16, above - sound.height - 8);
    else if (below >= sound.height + 12) top = Math.min(height - sound.height - 4, bounds.bottom + 8);
    else top = above > below ? Math.max(2, bounds.top - sound.height - 2) : Math.min(height - sound.height - 2, bounds.bottom + 2);
    music.style.setProperty('--map-music-top', Math.round(top) + 'px');
    music.classList.add('map-safe-dock');
  };
  const request = () => {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { near = entries[0].isIntersecting; request(); }, { rootMargin: '80px' }).observe(map);
  else near = true;
  addEventListener('scroll', () => { if (near) request(); }, { passive: true });
  addEventListener('resize', request, { passive: true });
  addEventListener('pageshow', request);
  window.visualViewport?.addEventListener('resize',request,{ passive: true });
  if (toggle) new MutationObserver(request).observe(toggle,{ attributes: true, attributeFilter: ['aria-pressed'] });
  request();
})();
