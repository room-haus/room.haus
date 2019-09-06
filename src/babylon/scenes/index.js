import {getMix} from 'src/mixes';
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
import * as RM001 from './RM001';
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
  RM001: {
    id: 'RM001',
    ...RM001,
  },
};

export const getMixConfig = (id) => {
  let config = mixConfigs[id];
  if (!config) {
    const {art, label} = getMix(id);
    config = {
      ...defaultConfig,
      caseTexture: art,
      cdLabelTexture: label,
    };
  }
  return config;
};
