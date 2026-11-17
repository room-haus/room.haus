import React from 'react';
import SiteHeader from '../components/SiteHeader';
import {navigate} from './navigation';

export default function NotFoundPage({section = 'mixes'}) {
  return (
    <>
      <SiteHeader section={section} />
      <main className="not-found">
        <span className="catalogue-code">404</span>
        <h1>Page unavailable</h1>
        <a href={`/${section}/`} onClick={(event) => navigate(event, `/${section}/`)}>
          Browse {section} <span aria-hidden="true">→</span>
        </a>
      </main>
    </>
  );
}
