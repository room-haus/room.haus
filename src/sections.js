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
  portrait.addEventListener('click', () => {
    portrait.setAttribute('aria-pressed', String(portrait.getAttribute('aria-pressed') !== 'true'));
  });
}
