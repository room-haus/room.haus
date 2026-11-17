import {mixes, releases, routeOf, coverName} from './catalog.mjs';

const entities = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const escape = (value) => String(value).replace(/[&<>"']/g, (char) => entities[char]);

// Webpack fingerprints these assets. Resolve the actual build output so the browser reuses the same URLs after mount.
export function assetLookup(files) {
  const assets = new Map(
    files.flatMap((file) => {
      const match = /^(.+)\.[a-f0-9]{12}(\.[^.]+)$/.exec(file);
      return match ? [[match[1] + match[2], '/assets/' + file]] : [];
    }),
  );
  return (name) => {
    if (!assets.has(name)) throw Error('Missing emitted asset: ' + name);
    return assets.get(name);
  };
}

function header(section, asset, detail = false) {
  const links = detail
    ? `<a class="back-link" href="/${section}/"><span aria-hidden="true">←</span> Back to ${section}</a>`
    : `<nav class="out-links" aria-label="Contact and social links">
        <a href="https://soundcloud.com/room-haus">SoundCloud<span aria-hidden="true">↗</span></a>
        <a href="https://www.instagram.com/room.haus/">Instagram<span aria-hidden="true">↗</span></a>
        <a href="mailto:info@room.haus">Email<span aria-hidden="true">↗</span></a>
      </nav>`;
  return `<header class="site-header"><a class="wordmark" href="/${section}/" aria-label="ROOM archive">
    <img src="${asset('logo.png')}" alt="ROOM" width="1307" height="240"></a>${links}</header>`;
}

export function archiveBody(section, asset) {
  const collections = {mixes, releases};
  const tabs = Object.entries(collections).map(([name, items]) => {
    const current = name === section;
    const link = `<a href="/${name}/"${current ? ' aria-current="page"' : ''}><span>${name.toUpperCase()}</span><sup>${String(items.length).padStart(2, '0')}</sup></a>`;
    return current ? `<h1>${link}</h1>` : link;
  });
  const sleeves = collections[section].map(
    (record, index) =>
      `<li><a class="sleeve" href="${escape(routeOf(record))}">
      <img src="${asset(coverName(record) + '.jpg')}" alt="" width="500" height="500" decoding="async" loading="${index < 6 ? 'eager' : 'lazy'}">
      <div class="caption"><span class="catalogue-code">${escape(record.id)}</span> <span class="artist">${escape(record.artist)}</span></div>
      ${record.slug ? `<span class="release-name">${escape(record.name)}</span>` : ''}
    </a></li>`,
  );
  return `<div class="archive-page static-archive">
    <a class="skip-link" href="#archive-grid">Skip to recordings</a>
    ${header(section, asset)}
    <main class="archive-main"><div class="archive-toolbar"><nav class="collection-nav" aria-label="Record collections">${tabs.join('')}</nav></div>
      <ul id="archive-grid" class="cover-wall" tabindex="-1" aria-label="${section} catalogue">${sleeves.join('')}</ul>
    </main></div>`;
}

export function recordBody(record, asset) {
  const section = record.slug ? 'releases' : 'mixes';
  const cover = asset(coverName(record) + '.jpg');
  const tracklist = record.tracks
    ? `<details class="static-tracks">
    <summary class="tracks-action">Tracklist <span>${String(record.tracks.length).padStart(2, '0')}</span></summary>
    <ol class="tracks-panel" aria-label="Tracklist">${record.tracks.map((track) => `<li>${escape(track.name)}</li>`).join('')}</ol>
  </details>`
    : '';
  const listen = [
    [record.soundcloud, 'SoundCloud'],
    [record.purchaseLink, 'Bandcamp'],
  ]
    .filter(([url]) => url)
    .map(
      ([url, service]) =>
        `<a class="external-listen" href="${escape(url)}">Listen on ${service} <span aria-hidden="true">↗</span></a>`,
    );
  return `<div class="player-page static-record">
    ${header(section, asset, true)}
    <main class="listening-stage" aria-label="Artwork"><div class="still-stage"><div class="still-object">
      <div class="compact-disc" aria-hidden="true"><img src="${asset('cd_template_' + record.label + '.png')}" alt=""></div>
      <img class="still-cover" src="${cover}" alt="${escape(record.artist)} — ${escape(record.id)} cover" width="500" height="500">
    </div></div></main>
    <section class="transport" aria-label="Recording details">
      <div class="track-meta"><img src="${cover}" alt="" width="58" height="58"><div>
        <span class="catalogue-code">${escape(record.id)}</span><h1>${escape(record.artist)}</h1>
        ${record.name ? `<p>${escape(record.name)}</p>` : ''}
      </div></div><div class="static-links">${listen.join('')}${tracklist}</div>
    </section></div>`;
}
