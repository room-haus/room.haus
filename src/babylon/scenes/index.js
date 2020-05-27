import {getContent} from 'src/content';
import * as MX009 from './MX009';
import * as MX010 from './MX010';
import * as MX011 from './MX011';
import * as MX012 from './MX012';
import * as MX013 from './MX013';
import * as MX018 from './MX018';
import * as MX019 from './MX019';
import * as MX020 from './MX020';
import * as MX021 from './MX021';
import * as MX022 from './MX022';
import * as MX023 from './MX023';
import * as MX024 from './MX024';
import * as MX025 from './MX025';
import * as MX026 from './MX026';
import * as MX027 from './MX027';
import * as MX028 from './MX028';
import * as MX029 from './MX029';
import * as MX030 from './MX030';
import * as MX031 from './MX031';
import * as MX032 from './MX032';
import * as MX033 from './MX033';
import * as MX034 from './MX034';
import * as MX035 from './MX035';
import * as MX036 from './MX036';
import * as MX037 from './MX037';
import * as MX038 from './MX038';
import * as MX039 from './MX039';
import * as MX040 from './MX040';
import * as MX041 from './MX041';
import * as MX042 from './MX042';
import * as MX043 from './MX043';
import * as MX044 from './MX044';
import * as MX045 from './MX045';
import * as MX046 from './MX046';
import * as MX047 from './MX047';
import * as MX048 from './MX048';
import * as MX049 from './MX049';
import * as MX050 from './MX050';
import * as MX051 from './MX051';
import * as MX052 from './MX052';
import * as MX053 from './MX053';
import * as MX054 from './MX054';
import * as MX055 from './MX055';
import * as MX056 from './MX056';
import * as MX057 from './MX057';
import * as MX058 from './MX058';
import * as MX059 from './MX059';
import * as MX060 from './MX060';
import * as MX061 from './MX061';
import * as MX062 from './MX062';
import * as MX063 from './MX063';
import * as MX064 from './MX064';
import * as MX065 from './MX065';
import * as MX066 from './MX066';
import * as MX067 from './MX067';
import * as MX068 from './MX068';
import * as MX069 from './MX069';
import * as MX070 from './MX070';
import * as MX071 from './MX071';
import * as MX072 from './MX072';
import * as MX073 from './MX073';

import * as RM001 from './RM001';
import * as ROOM001A from './ROOM001A';
import * as ROOM001 from './ROOM001';
import * as defaultConfig from './default';

export const mixConfigs = {
  MX009: {
    id: 'MX009',
    ...MX009,
  },
  MX010: {
    id: 'MX010',
    ...MX010,
  },
  MX011: {
    id: 'MX011',
    ...MX011,
  },
  MX012: {
    id: 'MX012',
    ...MX012,
  },
  MX013: {
    id: 'MX013',
    ...MX013,
  },
  MX018: {
    id: 'MX018',
    ...MX018,
  },
  MX019: {
    id: 'MX019',
    ...MX019,
  },
  MX020: {
    id: 'MX020',
    ...MX020,
  },
  MX021: {
    id: 'MX021',
    ...MX021,
  },
  MX022: {
    id: 'MX022',
    ...MX022,
  },
  MX023: {
    id: 'MX023',
    ...MX023,
  },
  MX024: {
    id: 'MX024',
    ...MX024,
  },
  MX025: {
    id: 'MX025',
    ...MX025,
  },
  MX026: {
    id: 'MX026',
    ...MX026,
  },
  MX027: {
    id: 'MX027',
    ...MX027,
  },
  MX028: {
    id: 'MX028',
    ...MX028,
  },
  MX029: {
    id: 'MX029',
    ...MX029,
  },
  MX030: {
    id: 'MX030',
    ...MX030,
  },
  MX031: {
    id: 'MX031',
    ...MX031,
  },
  MX032: {
    id: 'MX032',
    ...MX032,
  },
  MX033: {
    id: 'MX033',
    ...MX033,
  },
  MX034: {
    id: 'MX034',
    ...MX034,
  },
  MX035: {
    id: 'MX035',
    ...MX035,
  },
  MX036: {
    id: 'MX036',
    ...MX036,
  },
  MX037: {
    id: 'MX037',
    ...MX037,
  },
  MX038: {
    id: 'MX038',
    ...MX038,
  },
  MX039: {
    id: 'MX039',
    ...MX039,
  },
  MX040: {
    id: 'MX040',
    ...MX040,
  },
  MX041: {
    id: 'MX041',
    ...MX041,
  },
  MX042: {
    id: 'MX042',
    ...MX042,
  },
  MX043: {
    id: 'MX043',
    ...MX043,
  },
  MX044: {
    id: 'MX044',
    ...MX044,
  },
  MX045: {
    id: 'MX045',
    ...MX045,
  },
  MX046: {
    id: 'MX046',
    ...MX046,
  },
  MX047: {
    id: 'MX047',
    ...MX047,
  },
  MX048: {
    id: 'MX048',
    ...MX048,
  },
  MX049: {
    id: 'MX049',
    ...MX049,
  },
  MX050: {
    id: 'MX050',
    ...MX050,
  },
  MX051: {
    id: 'MX051',
    ...MX051,
  },
  MX052: {
    id: 'MX052',
    ...MX052,
  },
  MX053: {
    id: 'MX053',
    ...MX053,
  },
  MX054: {
    id: 'MX054',
    ...MX054,
  },
  MX055: {
    id: 'MX055',
    ...MX055,
  },
  MX056: {
    id: 'MX056',
    ...MX056,
  },
  MX057: {
    id: 'MX057',
    ...MX057,
  },
  MX058: {
    id: 'MX058',
    ...MX058,
  },
  MX059: {
    id: 'MX059',
    ...MX059,
  },
  MX060: {
    id: 'MX060',
    ...MX060,
  },
  MX061: {
    id: 'MX061',
    ...MX061,
  },
  MX062: {
    id: 'MX062',
    ...MX062,
  },
  MX063: {
    id: 'MX063',
    ...MX063,
  },
  MX064: {
    id: 'MX064',
    ...MX064,
  },
  MX065: {
    id: 'MX065',
    ...MX065,
  },
  MX066: {
    id: 'MX066',
    ...MX066,
  },
  MX067: {
    id: 'MX067',
    ...MX067,
  },
  MX068: {
    id: 'MX068',
    ...MX068,
  },
  MX069: {
    id: 'MX069',
    ...MX069,
  },
  MX070: {
    id: 'MX070',
    ...MX070,
  },
  MX071: {
    id: 'MX071',
    ...MX071,
  },
  MX072: {
    id: 'MX072',
    ...MX072,
  },
  MX073: {
    id: 'MX073',
    ...MX073,
  },
  RM001: {
    id: 'RM001',
    ...RM001,
  },
  ROOM001A: {
    id: 'ROOM001A',
    ...ROOM001A,
  },
  ROOM001: {
    id: 'ROOM001',
    ...ROOM001,
  },
};

export const getMixConfig = (id) => {
  let config = mixConfigs[id];
  if (!config) {
    const {art, label} = getContent(id);
    config = {
      ...defaultConfig,
      caseTexture: art,
      cdLabelTexture: label,
    };
  }
  return config;
};
