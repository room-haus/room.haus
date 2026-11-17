import './styles/entrance.css';
import contourUrl from './images/punctuation-study.svg';

export function initStudy(stage) {
  const canvas = stage.querySelector('canvas');
  const toggle = stage.querySelector('.rotation-toggle');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rotating = !reduce.matches;
  let inView = !stage.closest('[inert]');
  let pending = false;
  let failed = false;
  let model;
  const events = new AbortController();
  const options = {signal: events.signal};

  function fallback() {
    failed = true;
    model?.dispose();
    model = undefined;
    stage.classList.remove('has-model');
    canvas.hidden = true;
    toggle.hidden = true;
  }

  function update() {
    if (failed) return;
    toggle.textContent = rotating ? 'Pause rotation' : 'Rotate loop';
    if (!rotating || model) toggle.hidden = false;
    if (!(rotating && inView && !stage.closest('[inert]') && !document.hidden)) {
      model?.pause();
      return;
    }
    if (model) {
      model.play();
      return;
    }
    prepare();
  }

  async function prepare(background = false) {
    if (failed || model || pending) return;
    pending = true;
    try {
      const {createPunctuationLoop} = await import(
        /* webpackChunkName: "punctuation-loop" */ './components/PunctuationLoop'
      );
      const loaded = await createPunctuationLoop(canvas, contourUrl);
      if (failed) {
        loaded.dispose();
        return;
      }
      model = loaded;
      canvas.tabIndex = 0;
      canvas.removeAttribute('aria-hidden');
      stage.classList.add('has-model');
      update();
    } catch {
      // A speculative download can fail transiently; actual entry gets its own attempt.
      if (!background) fallback();
    } finally {
      pending = false;
      if (background && !model && !failed && !stage.closest('[inert]')) update();
    }
  }

  toggle.addEventListener('click', () => {
    rotating = !rotating;
    update();
  }, options);
  reduce.addEventListener('change', () => {
    rotating = !reduce.matches;
    update();
  }, options);
  document.addEventListener('visibilitychange', update, options);
  canvas.addEventListener('webglcontextlost', fallback, options);
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    update();
  });
  observer.observe(stage);
  update();
  return {
    preload() {
      if (failed || model || pending || reduce.matches || navigator.connection?.saveData) return;
      // Warm a single paused scene after the archive has had time to paint.
      // Downloading alone leaves engine evaluation and shader setup on the home transition.
      const warm = () => {
        if (!reduce.matches && !navigator.connection?.saveData && !document.hidden) prepare(true);
      };
      if (window.requestIdleCallback) {
        const idle = window.requestIdleCallback(warm, {timeout: 2000});
        return () => window.cancelIdleCallback(idle);
      }
      const timeout = window.setTimeout(warm, 300);
      return () => window.clearTimeout(timeout);
    },
    dispose() {
      failed = true;
      events.abort();
      observer.disconnect();
      model?.dispose();
    },
  };
}
