import React, {lazy, Suspense, useEffect, useLayoutEffect, useState} from 'react';
import Archive from './Archive';
import NotFoundPage from './404';
import {readRoute} from './navigation';
import SiteHeader from '../components/SiteHeader';

export const loadPlayer = () => import(/* webpackChunkName: "player" */ './Player');
const LazyPlayer = lazy(loadPlayer);

export default function App({Player = LazyPlayer}) {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const update = () => setRoute((previousRoute) => ({...readRoute(), revision: (previousRoute.revision || 0) + 1}));
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('popstate', update);
      history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
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
    <Suspense
      fallback={
        <>
          <SiteHeader section={route.section} listening />
          <main className="page-loading" role="status">
            Opening {route.record.id}…
          </main>
        </>
      }
    >
      <Player key={route.record.id + ':' + (route.revision || 0)} record={route.record} section={route.section} />
    </Suspense>
  );
}
