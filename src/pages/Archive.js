import {hasCoverTitle} from '../content/catalogDisplay.mjs';
import React, {useRef, useState} from 'react';
import SiteHeader from '../components/SiteHeader';
import {mixes} from '../content/mixes';
import {releases} from '../content/releases';
import {navigate, openRecord, recordPath} from './navigation';

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function Search({query, onChange, section}) {
  const input = useRef(null);
  return (
    <div className="archive-search" role="search">
      <label htmlFor="archive-search">
        <span className="sr-only">Search {section}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true">
          <circle cx="10" cy="10" r="6.8" />
          <path d="m15 15 6 6" />
        </svg>
      </label>
      <input
        ref={input}
        id="archive-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Search ${section}`}
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            input.current.focus();
          }}>
          ×
        </button>
      )}
    </div>
  );
}

export default function Archive({route}) {
  const {section} = route;
  const [query, setQuery] = useState(route.query);
  const catalogue = section === 'mixes' ? mixes : releases;
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const visible = catalogue.filter((record) => {
    const text = normalize(
      [record.id, record.artist, record.name, ...(record.tracks || []).map((track) => track.name)].join(' '),
    );
    return terms.every((term) => text.includes(term));
  });
  const updateQuery = (value) => {
    setQuery(value);
    const url = new URL(location.href);
    if (value) url.searchParams.set('q', value);
    else url.searchParams.delete('q');
    history.replaceState({...history.state, archive: null}, '', url);
  };
  return (
    <div className="archive-page" data-arriving={route.revision ? '' : undefined}>
      <a className="skip-link" href="#archive-grid">
        Skip to recordings
      </a>
      <SiteHeader section={section} />
      <main className="archive-main">
        <div className="archive-toolbar">
          <nav aria-label="Record collections" className="collection-nav">
            {['mixes', 'releases'].map((name) => {
              const link = (
                <a
                  href={`/${name}/`}
                  aria-current={section === name ? 'page' : undefined}
                  onClick={(event) => navigate(event, `/${name}/`)}>
                  <span>{name.toUpperCase()}</span>
                  <sup>{name === 'mixes' ? mixes.length : releases.length.toString().padStart(2, '0')}</sup>
                </a>
              );
              return section === name ? <h1 key={name}>{link}</h1> : <div key={name}>{link}</div>;
            })}
          </nav>
          <Search query={query} onChange={updateQuery} section={section} />
        </div>
        <span className="sr-only" role="status">
          {visible.length} {section} found
        </span>
        {visible.length > 0 ? (
          <ul className="cover-wall" id="archive-grid" tabIndex="-1" aria-label={`${section} catalogue`}>
            {visible.map((record, index) => (
              <li key={record.id}>
                <a
                  id={`record-${record.id}`}
                  className="sleeve"
                  href={recordPath(record)}
                  onClick={(event) => openRecord(event, record)}>
                  <img
                    src={record.art}
                    alt=""
                    width="500"
                    height="500"
                    decoding="async"
                    loading={index < 6 ? 'eager' : 'lazy'}
                    data-pending=""
                    onLoad={(event) => event.currentTarget.removeAttribute('data-pending')}
                    onError={(event) => event.currentTarget.removeAttribute('data-pending')}
                  />
                  <div className="caption">
                    <span className="catalogue-code">{record.id}</span>
                    <span className="artist">{record.artist}</span>
                  </div>
                  {hasCoverTitle(record) && <span className="release-name">{record.name}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="no-results" id="archive-grid" tabIndex="-1">
            <h2>No {section} found</h2>
            <p>There are no matches for “{query}”.</p>
            <button
              onClick={() => {
                updateQuery('');
                document.getElementById('archive-search').focus();
              }}>
              Clear search
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
