import './styles/layout.css';
import './styles/entrance.css';

const sound = document.querySelector('.season-empty audio');
if (sound) {
  const key = document.querySelector('.sound-key');
  const status = document.querySelector('.sound-status');
  sound.controls = false;
  key.hidden = false;
  sound.addEventListener('waiting', () => { status.textContent = 'Loading sound…'; });
  sound.addEventListener('playing', () => {
    status.textContent = '';
    key.classList.add('is-playing');
  });
  for (const event of ['ended', 'pause']) {
    sound.addEventListener(event, () => {
      status.textContent = '';
      key.classList.remove('is-playing');
    });
  }
  key.addEventListener('click', async () => {
    status.textContent = '';
    sound.currentTime = 0;
    try {
      await sound.play();
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Sound unavailable.';
    }
  });
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
for (const portrait of document.querySelectorAll('.portrait')) {
  const photo = portrait.querySelector('img');
  portrait.dataset.imageState = 'loading';
  photo.decode().then(() => {
    portrait.dataset.imageState = 'ready';
  }).catch(() => {
    portrait.dataset.imageState = 'failed';
  });
  const pixels = portrait.querySelector('.pixel-print');
  const coarse = document.createElement('canvas');
  coarse.className = 'pixel-print pixel-core';
  coarse.setAttribute('aria-hidden', 'true');
  coarse.width = 64;
  coarse.height = 80;
  const brush = coarse.getContext('2d');
  // The original print remains the fallback while the canvas source loads.
  pixels.after(coarse);
  const trails = [pixels.cloneNode(), pixels.cloneNode()];
  trails.forEach((trail, index) => {
    trail.classList.add('pixel-trail', 'pixel-trail-' + index);
    portrait.append(trail);
  });

  let target = {x: 50, y: 50};
  const positions = [{...target}, {...target}, {...target}];
  let frame = 0;
  let lastTime = 0;
  let sourceReady = false;
  pixels.decode().then(() => {
    sourceReady = true;
    brush.drawImage(pixels, 0, 0, coarse.width, coarse.height);
  }).catch(() => {});

  function place(node, point) {
    node.style.setProperty('--patch-x', point.x + '%');
    node.style.setProperty('--patch-y', point.y + '%');
  }

  function paint(time) {
    frame = 0;
    const step = Math.min((time - lastTime) / 16.67 || 1, 3);
    lastTime = time;
    const speed = Math.hypot(target.x - positions[0].x, target.y - positions[0].y);
    positions.forEach((point, index) => {
      const destination = index ? positions[index - 1] : target;
      const ease = 1 - Math.pow(1 - [0.65, 0.22, 0.14][index], step);
      point.x += (destination.x - point.x) * ease;
      point.y += (destination.y - point.y) * ease;
      place(index ? trails[index - 1] : portrait, point);
    });
    portrait.style.setProperty('--patch-radius', Math.min(32, 20 + speed * .45) + '%');
    if (sourceReady) {
      const resolution = Math.round(Math.max(32, 64 - speed));
      if (coarse.width !== resolution) {
        coarse.width = resolution;
        coarse.height = Math.round(resolution * 1.25);
      }
      brush.drawImage(pixels, 0, 0, coarse.width, coarse.height);
    }
    const unsettled = Math.hypot(target.x - positions[2].x, target.y - positions[2].y) > .1;
    portrait.classList.toggle('is-scrambling', unsettled);
    if (unsettled) frame = requestAnimationFrame(paint);
  }

  function positionPatch(event) {
    const bounds = portrait.getBoundingClientRect();
    target = {
      x: (event.clientX - bounds.left) / bounds.width * 100,
      y: (event.clientY - bounds.top) / bounds.height * 100,
    };
    if (reduceMotion.matches) {
      place(portrait, target);
      return;
    }
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(paint);
    }
  }
  portrait.addEventListener('pointerenter', event => {
    positionPatch(event);
    positions.forEach(point => Object.assign(point, target));
    place(portrait, target);
  });
  portrait.addEventListener('pointermove', positionPatch);
  portrait.addEventListener('pointerdown', positionPatch);
  portrait.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    portrait.classList.remove('is-scrambling');
  });
  portrait.addEventListener('click', event => {
    if (event.detail === 0) {
      target = {x: 50, y: 50};
      positions.forEach(point => Object.assign(point, target));
      place(portrait, target);
    }
    portrait.setAttribute('aria-pressed', String(portrait.getAttribute('aria-pressed') !== 'true'));
  });
}
