import './styles/layout.css';
import './styles/entrance.css';
import contourUrl from './images/punctuation-study.svg';

// Bookmarked searches from the former homepage still open the filtered archive.
if (['/', '/index.html'].includes(location.pathname) && new URLSearchParams(location.search).has('q')) {
  location.replace('/mixes/' + location.search + location.hash);
}

const stage = document.querySelector('.type-study');
if (stage) {
  const canvas = stage.querySelector('canvas');
  const toggle = stage.querySelector('.rotation-toggle');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rotating = !reduce.matches;
  let inView = true;
  let pending = false;
  let failed = false;
  let model;

  function fallback() {
    failed = true;
    model?.dispose();
    model = undefined;
    stage.classList.remove('has-model');
    canvas.hidden = true;
    toggle.hidden = true;
  }

  async function update() {
    if (failed) return;
    toggle.textContent = rotating ? 'Pause rotation' : 'Rotate loop';
    if (!rotating || model) toggle.hidden = false;
    if (!(rotating && inView && !document.hidden)) {
      model?.pause();
      return;
    }
    if (model) {
      model.play();
      return;
    }
    if (pending) return;
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
      fallback();
    } finally {
      pending = false;
    }
  }

  toggle.addEventListener('click', () => {
    rotating = !rotating;
    update();
  });
  reduce.addEventListener('change', () => {
    rotating = !reduce.matches;
    update();
  });
  document.addEventListener('visibilitychange', update);
  canvas.addEventListener('webglcontextlost', fallback);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    update();
  }).observe(stage);
  update();
}
