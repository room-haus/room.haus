import * as art from 'src/images/mix-art/';
import * as labels from 'src/images/mix-labels/';

const BASE_URL = 'https://roomhauscdnprd.blob.core.windows.net/releases/';

export const releases = [
  {
    id: 'ROOM001A',
    art: art.MX001,
    label: labels.MX001,
    artist: 'Amal',
    catalogueNumber: 'ROOM001A',
    slug: 'ROOM001A-AMAL-DANCECONCEPT',
    soundcloud: 'https://soundcloud.com/room-haus/room-mx001-eddy-bauer',
    tracks: [
      {name: '574S', streamURL: `${BASE_URL}ROOM001A/audio/574s.m3u8`},
      {name: '574S (35mm remix)', streamURL: `${BASE_URL}ROOM001A/audio/574s-35mm-remix.m3u8`},
    ],
  },
];

export const getRelease = (id) => releases.find((r) => id === r.id);
export const getReleaseBySlug = (slug) => releases.find((r) => slug === r.slug);
