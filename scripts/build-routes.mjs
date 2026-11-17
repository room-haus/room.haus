import entrancePages from '../src/content/entrance.json' with {type: 'json'};
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {records, mixes, routeOf, coverName, validateCatalog} from './catalog.mjs';
import {cloudFrontSource} from './routing.mjs';
import {archiveBody, assetLookup, escape, recordBody} from './static-pages.mjs';

const site = 'https://room.haus';
const dist = path.resolve('dist');
validateCatalog();
const template = await readFile(path.join(dist, 'mixes/index.html'), 'utf8');
const asset = assetLookup(await readdir(path.join(dist, 'assets')));
const root = /(<div id=(?:"root"|'root'|root)>)(?:<!--catalog-->[\s\S]*?<!--\/catalog-->)?<\/div>/i;
if (!root.test(template)) throw Error('Missing archive mount in the HTML template');
const pages = [
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
    tags['og:image'] = site + asset(coverName(record) + '.jpg');
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
  const body = record ? recordBody(record, asset) : archiveBody(route === '/releases/' ? 'releases' : 'mixes', asset);
  const html = template
    .replace(/<style id=["']?archive-slide["']?>/i, route === '/mixes/' ? '$&' : '<style id="archive-slide" media="not all">')
    .replace(/<!--catalog-head-->[\s\S]*?<!--\/catalog-head-->/, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, '')
    .replace('</head>', () => '<!--catalog-head-->' + head + '<!--/catalog-head-->\n</head>')
    .replace(root, (_, opening) => opening + '<!--catalog-->' + body + '<!--/catalog--></div>');
  await writeFile(path.join(dir, 'index.html'), html);
}
const routes = [...entrancePages.map(({path}) => path), ...pages.map(([route]) => route)];
await writeFile(
  path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    routes.map((route) => '  <url><loc>' + escape(site + route) + '</loc></url>').join('\n') +
    '\n</urlset>\n',
);
await writeFile(
  path.join(dist, '_redirects'),
  mixes.map((record) => '/mixes/ mx=' + record.id + ' ' + routeOf(record) + ' 301!').join('\n') + '\n',
);
await mkdir('release', {recursive: true});
await writeFile('release/room-routes.js', cloudFrontSource());
console.log('Built ' + routes.length + ' public pages, the sitemap and the CDN route table.');
