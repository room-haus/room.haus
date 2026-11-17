import './styles/layout.css';
import './styles/entrance.css';

const sound = document.querySelector('.season-empty audio');
if (sound) {
  const key = document.querySelector('.sound-key');
  const status = document.querySelector('.sound-status');
  sound.controls = false;
  key.hidden = false;
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

for (const portrait of document.querySelectorAll('.portrait')) {
  function positionPatch(event) {
    const bounds = portrait.getBoundingClientRect();
    portrait.style.setProperty('--patch-x', (event.clientX - bounds.left) / bounds.width * 100 + '%');
    portrait.style.setProperty('--patch-y', (event.clientY - bounds.top) / bounds.height * 100 + '%');
  }
  portrait.addEventListener('pointermove', positionPatch);
  portrait.addEventListener('pointerdown', positionPatch);
  portrait.addEventListener('click', event => {
    if (event.detail === 0) {
      portrait.style.setProperty('--patch-x', '50%');
      portrait.style.setProperty('--patch-y', '50%');
    }
    portrait.setAttribute('aria-pressed', String(portrait.getAttribute('aria-pressed') !== 'true'));
  });
}
