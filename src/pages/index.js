import React, {lazy, Suspense, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import Archive from './Archive';
import NotFoundPage from './404';
import StillArt from '../components/StillArt';
import ErrorBoundary from '../components/ErrorBoundary';
import {navigate, readRoute, returnToArchive} from './navigation';
import SiteHeader from '../components/SiteHeader';
import {initStudy} from '../entrance';
import {useRoomPanels} from './room-panels';

export const loadPlayer = () => import(/* webpackChunkName: "player" */ './Player');
const LazyPlayer = lazy(loadPlayer);

function screenState(route, previousArchive) {
  // Keep the first covers ready and retain the archive DOM throughout both directions of the slide.
  const archive = route.page === 'archive' ? route : previousArchive;
  return {route, archive};
}

export default function App({Player = LazyPlayer}) {
  const [{route, archive}, setScreen] = useState(() =>
    screenState(readRoute(), {page: 'archive', section: 'mixes', query: ''}),
  );
  const splash = route.page === 'splash';
  const studyStarted = useRef(false);
  useRoomPanels(route);
  useEffect(() => {
    if (splash && !studyStarted.current) {
      studyStarted.current = true;
      initStudy(document.querySelector('.type-study'));
    }
  }, [splash]);

  useLayoutEffect(() => {
    const seasonLink = document.querySelector('.entrance-nav a[href="/mixes/"]');
    const enterSeason = event => navigate(event, '/mixes/');
    let revision = 0;
    let transition;
    let currentRoute = readRoute();
    const update = () => {
      const next = {...readRoute(), revision: ++revision};
      const crossesSplash = currentRoute.page === 'splash' || next.page === 'splash';
      currentRoute = next;
      const commit = () => setScreen(previous => screenState(next, previous.archive));
      transition?.skipTransition();
      if (crossesSplash || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    seasonLink.addEventListener('click', enterSeason);
    return () => {
      revision++;
      transition?.skipTransition();
      window.removeEventListener('popstate', update);
      seasonLink.removeEventListener('click', enterSeason);
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    if (route.page === 'splash') {
      document.title = 'ROOM';
      if (route.revision) document.querySelector('.entrance-nav a[href="/mixes/"]').focus({preventScroll: true});
      return;
    }
    const archive = route.page === 'archive' && history.state?.archive;
    if (archive) {
      document.getElementById(`record-${archive.focus}`)?.focus({preventScroll: true});
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

  if (splash || route.page === 'archive') return <Archive key={archive.section} route={archive} />;
  if (route.page === 'missing') return <NotFoundPage section={route.section} />;
  return (
    <ErrorBoundary
      key={route.record.id}
      fallback={
        <>
          <SiteHeader section={route.section} listening />
          <main className="page-loading">
            Player unavailable. <a href={location.href}>Reload this recording</a>
          </main>
        </>
      }>
      <Suspense
        fallback={
          <main className="player-page">
            <StillArt record={route.record} pending={`Opening ${route.record.id}…`} />
            <a
              className="loading-back"
              href={history.state?.fromArchive?.url || '/' + route.section + '/'}
              onClick={(event) => returnToArchive(event, route.section)}>
              ← Back to {route.section}
            </a>
          </main>
        }>
        <Player key={route.record.id + ':' + (route.revision || 0)} record={route.record} section={route.section} />
      </Suspense>
    </ErrorBoundary>
  );
}
