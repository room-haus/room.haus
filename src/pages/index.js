import React, {lazy, Suspense, useEffect, useLayoutEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import Archive from './Archive';
import NotFoundPage from './404';
import StillArt from '../components/StillArt';
import ErrorBoundary from '../components/ErrorBoundary';
import {readRoute, returnToArchive} from './navigation';
import SiteHeader from '../components/SiteHeader';

export const loadPlayer = () => import(/* webpackChunkName: "player" */ './Player');
const LazyPlayer = lazy(loadPlayer);

export default function App({Player = LazyPlayer}) {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    let revision = 0;
    let transition;
    const update = () => {
      const next = {...readRoute(), revision: ++revision};
      transition?.skipTransition();
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setRoute(next);
        return;
      }

      // Only the selected sleeve needs its own snapshot. The rest of the viewport dissolves together.
      const sleeve = next.record && document.getElementById('record-' + next.record.id)?.querySelector('img');
      if (sleeve) sleeve.style.viewTransitionName = 'selected-sleeve';
      transition = document.startViewTransition(() => {
        if (sleeve) sleeve.style.removeProperty('view-transition-name');
        // A skipped transition can still run its callback after a second navigation.
        if (revision === next.revision) flushSync(() => setRoute(next));
      });
    };
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.addEventListener('popstate', update);
    return () => {
      revision++;
      transition?.skipTransition();
      window.removeEventListener('popstate', update);
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    // Client-side archive navigation can change which screen this same document represents.
    document.getElementById('archive-slide').media = route.page === 'archive' && route.section === 'mixes' ? 'all' : 'not all';
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

  if (route.page === 'archive') return <Archive key={route.revision || 0} route={route} />;
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
