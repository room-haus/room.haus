import React, {lazy, Suspense, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import Archive from './Archive';
import NotFoundPage from './404';
import StillArt from '../components/StillArt';
import ErrorBoundary from '../components/ErrorBoundary';
import {navigate, openRecord, panelForRoute, readRoute, recordPath, returnToArchive} from './navigation';
import SiteHeader from '../components/SiteHeader';
import {initStudy} from '../entrance';
import {useRoomPanels} from './room-panels';

export const loadPlayer = () => import(/* webpackChunkName: "player" */ './Player');
const LazyPlayer = lazy(loadPlayer);

function screenState(route, previous, playing) {
  // Keep the archive ready throughout both directions of the slide.
  const archive = route.page === 'archive' ? route : previous.archive;
  let session = previous.session;
  if (route.page === 'player') {
    const autoplay = session?.entry.record === route.record ? session.autoplay : playing;
    session = {entry: route, autoplay};
  }
  return {route, archive, session};
}

export default function App({Player = LazyPlayer}) {
  const [{route, archive, session}, setScreen] = useState(() =>
    screenState(readRoute(), {archive: {page: 'archive', section: 'mixes', query: ''}}, false),
  );
  const study = useRef(null);
  const activeAudio = useRef(null);
  useRoomPanels(route);
  useEffect(() => {
    study.current = initStudy(document.querySelector('.type-study'));
    return () => study.current.dispose();
  }, []);
  useEffect(() => {
    if (route.page === 'archive') return study.current.preload();
  }, [route.page]);

  useLayoutEffect(() => {
    const shell = document.querySelector('.room-shell');
    const enterSection = event => {
      const link = event.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin === location.origin && /^\/(?:mixes|releases|fw-2026(?:\/releases)?|collective)?\/?$/.test(url.pathname)) {
        navigate(event, url.pathname + url.search + url.hash);
      }
    };
    let revision = 0;
    let transition;
    let currentRoute = readRoute();
    const update = () => {
      const next = {...readRoute(), revision: ++revision};
      const crossesPanel = panelForRoute(currentRoute) !== panelForRoute(next);
      currentRoute = next;
      const current = activeAudio.current;
      const playing = ['playing', 'loading'].includes(current?.audio.snapshot.status);
      const commit = () => setScreen(previous => screenState(next, previous, playing));
      transition?.skipTransition();
      if (next.record && playing && (next.record !== current.record || next.search)) {
        // Start the replacement during this navigation gesture when the browser allows it.
        flushSync(commit);
        return;
      }
      if (crossesPanel || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        commit();
        return;
      }
      // Keep master's sleeve transition within the archive/player panel.
      const sleeve = next.record && document.getElementById('record-' + next.record.id)?.querySelector('img');
      if (sleeve) sleeve.style.viewTransitionName = 'selected-sleeve';
      transition = document.startViewTransition(() => {
        if (sleeve) sleeve.style.removeProperty('view-transition-name');
        if (revision === next.revision) flushSync(commit);
      });
    };
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.addEventListener('popstate', update);
    shell.addEventListener('click', enterSection);
    return () => {
      revision++;
      transition?.skipTransition();
      window.removeEventListener('popstate', update);
      shell.removeEventListener('click', enterSection);
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    if (panelForRoute(route) !== 'archive') {
      document.title = route.page === 'splash' ? 'ROOM' : (route.page === 'season' ? 'F/W 2026 · ' + route.collection : 'Collective') + ' — ROOM';
      if (route.revision) {
        const panel = document.querySelector('[data-room-panel="' + route.page + '"]');
        if (!panel.contains(document.activeElement)) {
          panel.querySelector(route.page === 'splash' ? '.entrance-nav a' : 'h1').focus({preventScroll: true});
        }
      }
      return;
    }
    const archive = route.page === 'archive' && history.state?.archive;
    if (archive) {
      const sleeve = document.getElementById(`record-${archive.focus}`);
      (sleeve || document.querySelector('.collection-nav [aria-current]'))?.focus({preventScroll: true});
      window.scrollTo(0, archive.y);
    } else {
      window.scrollTo(0, 0);
      if (route.page === 'archive' && route.revision)
        document.querySelector('.collection-nav [aria-current]')?.focus({preventScroll: true});
    }
    const title = route.record
      ? `${route.record.id} · ${route.record.artist}`
      : route.page === 'missing'
        ? 'Page unavailable'
        : route.section === 'mixes'
          ? 'Mixes'
          : 'Releases';
    document.title = `${title} — ROOM`;
  }, [route]);

  const visible = route.page === 'player';
  const closePlayer = () => {
    const target = {
      archive: '.collection-nav [aria-current]',
      missing: '.not-found a',
      splash: '[data-room-panel=splash] .entrance-nav a',
      season: '[data-room-panel=season] h1',
      collective: '[data-room-panel=collective] h1',
    }[route.page];
    document.querySelector(target)?.focus({preventScroll: true});
    setScreen(previous => ({...previous, session: null}));
  };
  const record = session?.entry.record;
  const section = session?.entry.section;
  const openPlayer = (event) => {
    if (route.page === 'archive' && route.section === section) openRecord(event, record);
    else navigate(event, recordPath(record));
  };

  return (
    <>
      {(panelForRoute(route) !== 'archive' || route.page === 'archive') && <Archive key={archive.section} route={archive} />}
      {route.page === 'missing' && <NotFoundPage section={route.section} />}
      {session && (
        <ErrorBoundary
          key={record.id}
          fallback={visible ? (
            <>
              <SiteHeader section={section} listening />
              <main className="page-loading">
                Player unavailable. <a href={location.href}>Reload this recording</a>
              </main>
            </>
          ) : null}>
          <Suspense
            fallback={visible ? (
              <main className="player-page">
                <StillArt record={record} pending={`Opening ${record.id}…`} />
                <a
                  className="loading-back"
                  href={history.state?.fromArchive?.url || '/' + section + '/'}
                  onClick={(event) => returnToArchive(event, section)}>
                  ← Back to {section}
                </a>
              </main>
            ) : null}>
            <Player
              entry={session.entry}
              visible={visible}
              autoplay={session.autoplay}
              activeAudio={activeAudio}
              onClose={closePlayer}
              onOpen={openPlayer}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
