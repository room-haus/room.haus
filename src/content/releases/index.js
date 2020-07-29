import * as art from 'src/images/mix-art/';
import * as labels from 'src/images/mix-labels/';

const BASE_URL = 'https://roomhauscdnprd.blob.core.windows.net/releases/';

export const releases = [
  {
    id: 'ROOM001A',
    art: art.RM001A,
    label: labels.MX001,
    artist: 'Amal',
    catalogueNumber: 'ROOM001A',
    slug: 'ROOM001A-AMAL-574S',
    purchaseLink: 'https://roomdc.bandcamp.com/album/574s-room001a',
    tracks: [
      {name: '574S', streamURL: `${BASE_URL}ROOM001A/audio/574s.m3u8`},
      {name: '574S (35mm remix)', streamURL: `${BASE_URL}ROOM001A/audio/574s-35mm-remix.m3u8`},
    ],
  },
  {
    id: 'ROOM001',
    art: art.RM001,
    label: labels.MX001,
    artist: 'Amal',
    catalogueNumber: 'ROOM001',
    slug: 'ROOM001-AMAL-DANCECONCEPT',
    purchaseLink: 'https://roomdc.bandcamp.com/album/dance-concept-room001',
    tracks: [
      {name: '990S', streamURL: `${BASE_URL}ROOM001/audio/990s.m3u8`},
      {name: 'GEORGIA AVE', streamURL: `${BASE_URL}ROOM001/audio/georgia-ave.m3u8`},
      {name: '574S', streamURL: `${BASE_URL}ROOM001/audio/574s.m3u8`},
      {name: 'DTS', streamURL: `${BASE_URL}ROOM001/audio/dts.m3u8`},
      {name: 'FREE JUDO', streamURL: `${BASE_URL}ROOM001/audio/free-judo.m3u8`},
      {name: 'FREE JUDO (UNCUT)', streamURL: `${BASE_URL}ROOM001/audio/free-judo-uncut.m3u8`},
    ],
  },
  {
    id: 'ROOM002',
    art: art.RM002,
    artist: 'VistaVision',
    catalogueNumber: 'ROOM002',
    slug: 'ROOM002-VISTA-VISION-SUN',
    purchaseLink: 'http://vistavision-room.bandcamp.com/album/s-u-n-room002',
    tracks: [
      {name: 'Commitment Issues', streamURL: `${BASE_URL}ROOM002/audio/commitment-issues.m3u8`},
      {name: 'So', streamURL: `${BASE_URL}ROOM002/audio/so.m3u8`},
      {name: 'S.U.N.', streamURL: `${BASE_URL}ROOM002/audio/sun.m3u8`},
      {name: 'Working Title', streamURL: `${BASE_URL}ROOM002/audio/working-title.m3u8`},
    ],
  },
  {
    id: 'ROOM003',
    art: art.RM002,
    artist: 'VistaVision',
    catalogueNumber: 'ROOM003',
    slug: 'ROOM003-VISTA-VISION-SUN',
    purchaseLink: 'http://vistavision-room.bandcamp.com/album/s-u-n-room002',
    tracks: [
      {name: 'Commitment Issues', streamURL: `${BASE_URL}ROOM002/audio/commitment-issues.m3u8`},
      {name: 'So', streamURL: `${BASE_URL}ROOM002/audio/so.m3u8`},
      {name: 'S.U.N.', streamURL: `${BASE_URL}ROOM002/audio/sun.m3u8`},
      {name: 'Working Title', streamURL: `${BASE_URL}ROOM002/audio/working-title.m3u8`},
    ],
  },
];

export const getRelease = (id) => releases.find((r) => id === r.id);
export const getReleaseBySlug = (slug) => releases.find((r) => slug === r.slug);
