import {createRoot} from 'react-dom/client';
import './styles/layout.css';
import App, {loadPlayer} from './pages';

const mount = document.getElementById('root');
if (mount.querySelector('.static-record')) {
  // Keep the readable detail and links in place until the interactive player can replace them.
  const notice = mount.querySelector('.stage-notice');
  notice.hidden = false;
  loadPlayer().then(
    ({default: Player}) => createRoot(mount).render(<App Player={Player} />),
    (error) => {
      notice.textContent = 'Player unavailable. Listening links are in Options.';
      console.error('Unable to load the ROOM player.', error);
    },
  );
} else {
  createRoot(mount).render(<App />);
}
