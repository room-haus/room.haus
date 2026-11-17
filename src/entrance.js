import './styles/layout.css';
import './styles/entrance.css';

// Bookmarked searches from the former homepage still open the filtered archive.
if (['/', '/index.html'].includes(location.pathname) && new URLSearchParams(location.search).has('q')) {
  location.replace('/mixes/' + location.search + location.hash);
}
