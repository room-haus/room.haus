import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {records, mixes, routeOf, coverName, validateCatalog} from './catalog.mjs';
import {cloudFrontSource} from './routing.mjs';

const site = 'https://room.haus';
const dist = path.resolve('dist');
validateCatalog();
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
const files = await readdir(path.join(dist, 'assets'));
const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const pages = [
  ['/', 'ROOM', 'Independent mixes and releases from ROOM.'],
  ['/mixes/', 'Mixes | ROOM', 'Browse the ROOM mix archive.'],
  ['/releases/', 'Releases | ROOM', 'Explore records released by ROOM.'],
  ...records.map((record) => [
    routeOf(record),
    [record.id, record.artist, record.name].filter(Boolean).join(' · ') + ' | ROOM',
    record.tracks
      ? 'Listen to ' + record.name + ' by ' + record.artist + ' on ROOM.'
      : 'Listen to ' + record.artist + ' in the ROOM mix series.',
    record,
  ]),
];
for (const [route, title, description, record] of pages) {
  const tags = {
    'og:type': record ? 'music.album' : 'website',
    'og:title': title,
    'og:description': description,
    'og:url': site + route,
  };
  if (record) {
    const name = coverName(record);
    const cover = files.find((file) => file.startsWith(name + '.') && file.endsWith('.jpg'));
    if (!cover) throw Error('Missing emitted cover: ' + name);
    tags['og:image'] = site + '/assets/' + cover;
    tags['og:image:alt'] = record.artist + ' — ' + record.id;
  }
  const head = [
    '<title>' + escape(title) + '</title>',
    '<meta name="description" content="' + escape(description) + '">',
    '<link rel="canonical" href="' + escape(site + route) + '">',
    ...Object.entries(tags).map(([key, value]) => '<meta property="' + key + '" content="' + escape(value) + '">'),
  ].join('\n');
  const dir = path.join(dist, route);
  await mkdir(dir, {recursive: true});
  const html = template
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, '')
    .replace('</head>', head + '\n</head>');
  await writeFile(path.join(dir, 'index.html'), html);
}
await writeFile(
  path.join(dist, '_redirects'),
  mixes.map((record) => '/mixes/ mx=' + record.id + ' ' + routeOf(record) + ' 301!').join('\n') + '\n',
);
await mkdir('release', {recursive: true});
await writeFile('release/room-routes.js', cloudFrontSource());
console.log('Built ' + pages.length + ' public pages and the CDN route table.');
