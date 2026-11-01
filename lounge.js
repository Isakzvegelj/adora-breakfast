/* Attempt music on entry; browser autoplay rules remain authoritative. */
(() => {
  const button = document.querySelector('#music-toggle');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!button || !AudioEngine) return;
  const label = button.querySelector('.music-label');
  const status = document.querySelector('#music-status');
  const sl = document.documentElement.lang === 'sl';
  const words = sl ? {
    off: 'Predvajaj', playing: 'Ustavi', loading: 'Ustavi', error: 'Poskusi znova',
    playLabel: 'Predvajaj sproščujočo glasbo', stopLabel: 'Ustavi glasbo',
    errorMessage: 'Glasbe ni mogoče naložiti. Poskusite znova.'
  } : {
    off: 'Play music', playing: 'Stop music', loading: 'Stop music', error: 'Try music',
    playLabel: 'Play lounge music', stopLabel: 'Stop lounge music',
    errorMessage: 'Music could not load. Try again.'
  };
  let context = null, source = null, volume = null, buffer = null, controller = null;
  let playing = false, loading = false, generation = 0, visitorStopped = false;
  let removeGesture = () => {}, awaitingFirstView = document.hidden, gestureAttempted = false;
  const paint = state => {
    button.dataset.state = state;
    const on = state === 'playing' || state === 'loading';
    button.closest('.music-control')?.classList.toggle('music-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-busy', String(state === 'loading'));
    button.setAttribute('aria-label', on ? words.stopLabel : words.playLabel);
    label.textContent = words[['blocked', 'stopped'].includes(state) ? 'off' : state];
    status.textContent = state === 'error' ? words.errorMessage : '';
  };
  const stop = async (manual = true) => {
    if (manual) visitorStopped = true;
    generation++; removeGesture(); controller?.abort(); controller = null;
    const wasLoading = loading;
    loading = false; playing = false; paint('stopped');
    try { source?.stop(); } catch { /* An already-stopped source has no work left. */ }
    source?.disconnect(); source = null; volume?.disconnect(); volume = null;
    const current = context;
    try {
      if (current && current.state !== 'closed') {
        // Close an unresolved autoplay attempt so a later click cannot wake it.
        if (wasLoading) { context = null; await current.close(); }
        else await current.suspend();
      }
    } catch { /* Keep Stop effective after native audio interruptions. */ }
  };
  const armFirstInteraction = () => {
    removeGesture();
    if (visitorStopped || document.hidden || gestureAttempted) return;
    const first = event => {
      if (!event.isTrusted || visitorStopped || document.hidden) return;
      if (event.target instanceof Element && event.target.closest('#music-toggle')) return;
      if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(event.key)) return;
      removeGesture(); gestureAttempted = true; void start(true);
    };
    document.addEventListener('click', first, { passive: true });
    document.addEventListener('keydown', first, { passive: true });
    removeGesture = () => {
      document.removeEventListener('click', first);
      document.removeEventListener('keydown', first);
      removeGesture = () => {};
    };
  };
  const start = async (automatic = false) => {
    if (playing || loading || document.hidden || (automatic && visitorStopped)) return;
    removeGesture();
    const own = ++generation; loading = true; paint('loading');
    try {
      if (!context || context.state === 'closed') {
        context = new AudioEngine();
        const current = context;
        current.onstatechange = () => {
          if (context === current && playing && current.state !== 'running') void stop(false);
        };
      }
      const current = context;
      // Blocked Web Audio resume promises may stay pending rather than reject.
      let timer;
      const ready = await Promise.race([
        current.resume().then(() => current.state === 'running'),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), automatic ? 300 : 1500); })
      ]).finally(() => clearTimeout(timer));
      if (own !== generation) return;
      if (!ready) {
        context = null; await current.close();
        if (own !== generation) return;
        if (automatic) { loading = false; paint('blocked'); armFirstInteraction(); return; }
        throw new Error('Playback needs visitor input');
      }
      if (!buffer) {
        controller = new AbortController();
        const response = await fetch('audio/lounge-v1.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Track unavailable');
        const track = await response.json();
        if (track.format !== 'mp3' || typeof track.audioBase64 !== 'string' || track.audioBase64.length > 280000 || track.duration > 30) throw new Error('Invalid track');
        const bytes = Uint8Array.from(atob(track.audioBase64), c => c.charCodeAt(0));
        const decoded = await current.decodeAudioData(bytes.buffer);
        if (own !== generation) return;
        if (decoded.duration > 30 || decoded.numberOfChannels !== 1) throw new Error('Invalid decoded track');
        buffer = decoded; controller = null;
      }
      if (own !== generation || document.hidden) { await stop(false); return; }
      volume = current.createGain(); volume.gain.value = 0.6;
      source = current.createBufferSource(); source.buffer = buffer;
      source.loop = true; source.loopEnd = Math.min(24, buffer.duration);
      source.connect(volume); volume.connect(current.destination); source.start();
      if (current.state !== 'running') throw new Error('Audio interrupted');
      loading = false; playing = true; paint('playing');
    } catch (error) {
      if (own !== generation) return;
      loading = false; playing = false;
      try { source?.stop(); } catch {}
      source?.disconnect(); volume?.disconnect(); source = null; volume = null;
      if (automatic && error?.name === 'NotAllowedError') {
        const current = context; context = null;
        try { if (current && current.state !== 'closed') await current.close(); } catch {}
        if (own !== generation) return;
        paint('blocked'); armFirstInteraction(); return;
      }
      paint('error');
      try { if (context && context.state !== 'closed') await context.suspend(); } catch {}
    }
  };
  button.hidden = false; paint('off');
  button.addEventListener('click', () => {
    if (playing || loading) void stop(true);
    else { visitorStopped = false; void start(false); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { removeGesture(); if (playing || loading) void stop(false); }
    else if (awaitingFirstView) { awaitingFirstView = false; void start(true); }
  });
  window.addEventListener('pagehide', () => {
    awaitingFirstView = false; generation++; removeGesture(); controller?.abort(); controller = null;
    playing = false; loading = false;
    try { source?.stop(); } catch {}
    source?.disconnect(); volume?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    context = null; source = null; volume = null; buffer = null; paint('off');
  });
  if (!awaitingFirstView) void start(true);
})();
