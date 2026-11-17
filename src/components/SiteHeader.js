import React from 'react';
import logo from '../images/logo.png';
import {navigate, returnToArchive} from '../pages/navigation';

export default function SiteHeader({section = 'mixes', listening = false}) {
  const path = (listening && history.state?.fromArchive?.url) || `/${section}/`;
  const back = (event) => (listening ? returnToArchive(event, section) : navigate(event, path));
  return (
    <header className="site-header">
      <a className="wordmark" href={path} onClick={back} aria-label="ROOM archive">
        <img src={logo} alt="ROOM" width="1307" height="240" />
      </a>
      {listening ? (
        <a className="back-link" href={path} onClick={back}>
          <span aria-hidden="true">←</span> Back to {section}
        </a>
      ) : (
        <nav className="out-links" aria-label="Contact and social links">
          <a href="https://soundcloud.com/room-haus">
            SoundCloud<span aria-hidden="true">↗</span>
          </a>
          <a href="https://www.instagram.com/room.haus/">
            Instagram<span aria-hidden="true">↗</span>
          </a>
          <a href="mailto:info@room.haus">
            Email<span aria-hidden="true">↗</span>
          </a>
        </nav>
      )}
    </header>
  );
}
