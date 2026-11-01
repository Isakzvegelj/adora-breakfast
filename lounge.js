/* One optional, pre-rendered loop. No audio context or track request before Play. */
(() => {
  const button = document.querySelector('#music-toggle');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!button || !AudioEngine) return;
  const label = button.querySelector('.music-label');
  const status = document.querySelector('#music-status');
  const sl = document.documentElement.lang === 'sl';
  const words = sl ? {
    off: 'Predvajaj', playing: 'Premor', loading: 'Prekliči', error: 'Poskusi znova',
    playLabel: 'Predvajaj sproščujočo glasbo', pauseLabel: 'Začasno ustavi glasbo',
    cancelLabel: 'Prekliči nalaganje glasbe', errorMessage: 'Glasbe ni mogoče naložiti. Poskusite znova.'
  } : {
    off: 'Play music', playing: 'Pause music', loading: 'Cancel', error: 'Try music',
    playLabel: 'Play lounge music', pauseLabel: 'Pause lounge music',
    cancelLabel: 'Cancel music loading', errorMessage: 'Music could not load. Try again.'
  };
  let context = null, source = null, buffer = null, controller = null;
  let playing = false, loading = false, generation = 0;
  const paint = state => {
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(state === 'playing'));
    button.setAttribute('aria-busy', String(state === 'loading'));
    button.setAttribute('aria-label', state === 'playing' ? words.pauseLabel : state === 'loading' ? words.cancelLabel : words.playLabel);
    label.textContent = words[state === 'paused' ? 'off' : state];
    status.textContent = state === 'error' ? words.errorMessage : '';
  };
  const pause = async () => {
    generation++; controller?.abort(); controller = null;
    loading = false; playing = false; paint('paused');
    try { if (context && context.state !== 'closed') await context.suspend(); } catch { /* Keep the control usable after an interruption. */ }
  };
  button.hidden = false; paint('off');
  button.addEventListener('click', async () => {
    if (playing || loading) { await pause(); return; }
    const own = ++generation; loading = true; paint('loading');
    try {
      if (!context || context.state === 'closed') {
        context = new AudioEngine();
        const current = context;
        current.onstatechange = () => {
          if (context === current && playing && current.state !== 'running') {
            playing = false; paint('paused');
          }
        };
      }
      const current = context;
      // Resume immediately in the visitor's click, before network/decode work.
      await current.resume();
      if (own !== generation) return;
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
      if (own !== generation || document.hidden) { await pause(); return; }
      if (!source) {
        const volume = current.createGain(); volume.gain.value = 0.6;
        source = current.createBufferSource(); source.buffer = buffer; source.loop = true; source.loopEnd = Math.min(24, buffer.duration);
        source.connect(volume); volume.connect(current.destination); source.start();
      }
      if (current.state !== 'running') throw new Error('Audio interrupted');
      loading = false; playing = true; paint('playing');
    } catch {
      if (own !== generation) return;
      loading = false; playing = false; paint('error');
      try { if (context && context.state !== 'closed') await context.suspend(); } catch { /* Native audio may already be closed. */ }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || loading)) void pause(); });
  window.addEventListener('pagehide', () => {
    generation++; controller?.abort(); controller = null; playing = false; loading = false;
    try { source?.stop(); } catch { /* A stopped source needs no further work. */ }
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    context = null; source = null; buffer = null; paint('off');
  });
})();
