import {getMix, mixes} from './mixes';
import {getRelease, getReleaseBySlug, releases} from './releases';

export {getMix};
export {getRelease, getReleaseBySlug};

export const getContent = (id) => {
  if (id.startsWith('MX')) {
    return getMix(id);
  }
  return getRelease(id);
};

export const getContentList = (contentType) => {
  const map = {
    mix: mixes,
    release: releases,
  };
  return map[contentType] || [];
};
