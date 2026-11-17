import {mixes} from '../content/mixes';
import {releases} from '../content/releases';

export function recordPath(record) {
  return record.slug ? `/releases/${record.slug}/` : `/mixes/${record.id}/`;
}

export function readRoute() {
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/\/$/, '');
  const query = url.searchParams.get('q') || '';
  if (path === '' || path === '/index.html') return {page: 'archive', section: 'mixes', query};
  const match = /^\/(mixes|releases)(?:\/([^/]+))?$/.exec(path);
  if (!match) return {page: 'missing', section: 'mixes'};
  const [, section, id] = match;
  const key = id ?? (section === 'mixes' ? url.searchParams.get('mx')?.toUpperCase() : undefined);
  if (key !== undefined) {
    const record =
      section === 'mixes'
        ? mixes.find((item) => item.id === key)
        : releases.find((item) => item.id === key || item.slug === key);
    return {page: record ? 'player' : 'missing', section, record};
  }
  return {page: 'archive', section, query};
}

export function navigate(event, path, state = {}) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  window.history.pushState(state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', {state}));
}

export function openRecord(event, record) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const archive = {url: location.pathname + location.search, y: window.scrollY, focus: record.id};
  window.history.replaceState({...window.history.state, archive}, '');
  navigate(event, recordPath(record), {fromArchive: archive});
}

export function openNextMix(event, record) {
  const {fromArchive, mixSteps = 0} = history.state || {};
  navigate(event, recordPath(record), fromArchive ? {fromArchive, mixSteps: mixSteps + 1} : {});
}

export function returnToArchive(event, section) {
  const archive = window.history.state?.fromArchive;
  if (!archive) {
    navigate(event, `/${section}/`);
    return;
  }
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.history.go(-1 - (history.state.mixSteps || 0));
}
