import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../styles/layout.css';
import './labs.css';
import logo from '../images/logo.png';
import {ExperienceModal} from './ExperienceModal';
import {experiences} from './experiences';
import {categories, defaults, palettes, selectionFromHash, studies} from './studies';

const sessionKey = 'room-labs-session';
function hasSession() {
  try { return sessionStorage.getItem(sessionKey) === 'open'; } catch { return false; }
}

function Login({onLogin}) {
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // This is intentionally a lightweight client-side gate, not private authentication.
    if (data.get('username') === 'admin' && data.get('password') === 'BigSmall') {
      try { sessionStorage.setItem(sessionKey, 'open'); } catch { /* In-memory login still works. */ }
      onLogin();
    } else setError('Incorrect username or password.');
  }
  return <main className="labs-login">
    <a className="labs-login-home" href="/" aria-label="ROOM home"><img src={logo} alt="ROOM" width="1307" height="240" /></a>
    <form className="labs-login-form" onSubmit={submit}>
      <span className="labs-eyebrow">Internal playground</span>
      <h1>Labs access</h1>
      <p>Experiments for what comes next.</p>
      <label htmlFor="labs-username">Username</label>
      <input id="labs-username" name="username" autoComplete="username" required spellCheck="false" autoCapitalize="none" aria-describedby={error ? 'login-error' : undefined} aria-invalid={!!error} onChange={() => setError('')} />
      <label htmlFor="labs-password">Password</label>
      <input id="labs-password" name="password" type="password" autoComplete="current-password" required aria-describedby={error ? 'login-error' : undefined} aria-invalid={!!error} onChange={() => setError('')} />
      {error && <p className="labs-login-error" id="login-error" role="alert">{error}</p>}
      <button type="submit">Enter labs <span aria-hidden="true">↗</span></button>
    </form>
    <p className="labs-login-footer">ROOM.HAUS / WORK IN PROGRESS</p>
  </main>;
}

function Stage({study, settings, paused, reset, apiRef, onState}) {
  const canvas = useRef(null);
  const latest = useRef({settings, paused});
  latest.current = {settings, paused};
  const [state, setState] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    let scene;
    setState('loading');
    onState('loading');
    import(/* webpackChunkName: "labs-scene" */ './scene').then(({createStudy}) => {
      if (cancelled) return;
      scene = createStudy(canvas.current, study.id, () => latest.current);
      apiRef.current = scene;
      setState('ready');
      onState('ready');
    }).catch(() => {
      if (!cancelled) { setState('error'); onState('error'); }
    });
    return () => { cancelled = true; scene?.dispose(); apiRef.current = null; };
  }, [study.id, reset]);
  return <div className="labs-stage" data-state={state}>
    <div className="labs-stage-grid" aria-hidden="true" />
    <span className="labs-cross labs-cross--tl" aria-hidden="true">+</span>
    <span className="labs-cross labs-cross--br" aria-hidden="true">+</span>
    <div className="labs-stage-label" aria-hidden="true"><span>ROOM / STUDY {String(studies.indexOf(study) + 1).padStart(2, '0')}</span><span>THREE DIMENSIONS</span></div>
    <canvas ref={canvas} tabIndex={state === 'ready' ? 0 : -1} role="img" aria-label={`${study.title}, interactive 3D study. ${study.hint} Arrow keys rotate; plus and minus zoom.`} />
    {state === 'loading' && <p className="labs-stage-message" role="status">Preparing the study…</p>}
    {state === 'error' && <div className="labs-stage-message" role="alert"><strong>3D is unavailable in this browser.</strong><p>Try a browser with WebGL enabled, or reload to try again.</p><a href={location.href}>Reload labs ↗</a></div>}
    <div className="labs-stage-caption"><span>{study.hint}</span><span aria-hidden="true">X / Y / Z</span></div>
  </div>;
}

function Workspace({onLogout}) {
  const experienceLauncher = useRef(null);
  const [activeExperienceId, setActiveExperienceId] = useState(null);
  const closeExperience = useCallback(() => setActiveExperienceId(null), []);
  const initial = selectionFromHash(location.hash);
  const [section, setSection] = useState(initial?.category || '3d-animations');
  const [active, setActive] = useState(initial?.study || studies[0].id);
  const [values, setValues] = useState(() => Object.fromEntries(studies.map(item => [item.id, defaults()])));
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [reset, setReset] = useState(0);
  const [stageState, setStageState] = useState('loading');
  const [notice, setNotice] = useState('');
  const api = useRef(null);
  const heading = useRef(null);
  const categoryNavigation = useRef(null);
  const studyNavigation = useRef(null);
  const study = studies.find(item => item.id === active);
  const category = categories.find(item => item.id === section);
  const is3D = section === '3d-animations';
  const categoryExperiences = experiences.filter(item => (item.category || 'experiences') === section);
  const settings = values[active];
  function update(key, value) { setValues(previous => ({...previous, [active]: {...previous[active], [key]: value}})); }
  function select(id) {
    setActive(id);
    setSection('3d-animations');
    setNotice('');
    history.replaceState(null, '', '#3d-animations/' + id);
  }
  function selectCategory(id) {
    setSection(id);
    setNotice('');
    history.replaceState(null, '', '#' + id + (id === '3d-animations' ? '/' + active : ''));
  }
  useLayoutEffect(() => {
    // Reveal the active tab inside its own mobile scroll strip without moving the page.
    for (const nav of [categoryNavigation.current, studyNavigation.current]) {
      const selected = nav?.querySelector('[aria-current]');
      if (!selected || nav.scrollWidth <= nav.clientWidth) continue;
      const tab = selected.getBoundingClientRect();
      const strip = nav.getBoundingClientRect();
      if (tab.left < strip.left) nav.scrollLeft += tab.left - strip.left - 12;
      else if (tab.right > strip.right) nav.scrollLeft += tab.right - strip.right + 12;
    }
  }, [active, section]);
  useEffect(() => {
    document.title = (is3D ? study.title : category.title) + ' — ROOM Labs';
    heading.current?.focus({preventScroll: true});
  }, [active, section]);
  useEffect(() => {
    const change = () => {
      const selection = selectionFromHash(location.hash);
      if (!selection) return;
      setSection(selection.category);
      if (selection.study) setActive(selection.study);
      setNotice('');
    };
    window.addEventListener('hashchange', change);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media.matches) setPaused(true); };
    media.addEventListener('change', reduce);
    return () => { window.removeEventListener('hashchange', change); media.removeEventListener('change', reduce); };
  }, []);
  async function save() {
    try { await api.current?.save(); setNotice('Image saved.'); }
    catch { setNotice('Could not save the image. Try again.'); }
  }
  return <div className="labs-workspace">
    <a className="skip-link" href="#labs-study">Skip to experiment</a>
    <aside className="labs-sidebar">
      <a className="labs-brand" href="/" aria-label="ROOM home"><img src={logo} alt="ROOM" width="1307" height="240" /><span>Labs</span></a>
      <p className="labs-sidebar-intro">A space for<br />unfinished ideas.</p>
      <div className="labs-nav-heading labs-category-heading"><span>Playgrounds</span><span>{String(categories.length).padStart(2, '0')}</span></div>
      <nav ref={categoryNavigation} aria-label="Experiment categories" className="labs-categories">
        {categories.map(item => <button type="button" key={item.id} aria-label={item.title} aria-current={item.id === section ? 'true' : undefined} onClick={() => selectCategory(item.id)}><span>{item.title}</span><span className="labs-category-count" aria-hidden="true">{item.id === '3d-animations' ? String(studies.length).padStart(2, '0') : String(experiences.filter(experience => (experience.category || 'experiences') === item.id).length).padStart(2, '0')}</span></button>)}
      </nav>
      {is3D && <div className="labs-subnav-group"><div className="labs-nav-heading labs-subnav-heading"><span>3D animations</span><span>{String(studies.length).padStart(2, '0')}</span></div>
      <nav ref={studyNavigation} aria-label="3D animation experiments" className="labs-nav">
        {studies.map((item, index) => <button type="button" key={item.id} aria-current={item.id === active ? 'page' : undefined} onClick={() => select(item.id)}><span className="labs-nav-number">{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span><span className="labs-nav-arrow" aria-hidden="true">↗</span></button>)}
      </nav></div>}
      <div className="labs-sidebar-bottom"><p>Always a work<br />in progress. <span aria-hidden="true">✳</span></p><div><a href="/">Back to ROOM ↗</a><button type="button" onClick={onLogout}>Sign out</button></div></div>
    </aside>
    <main className="labs-main" id="labs-study" tabIndex="-1">
      <header className="labs-topline"><span>THE PLAYGROUND</span><span><i aria-hidden="true" /> NEXT SEASON / RESEARCH</span></header>
      <div className="labs-study-heading"><div><p className="labs-eyebrow">{is3D ? `3D ANIMATIONS / EXPERIMENT ${String(studies.indexOf(study) + 1).padStart(2, '0')}` : 'PLAYGROUND / ' + String(categories.indexOf(category) + 1).padStart(2, '0')}</p><h1 ref={heading} tabIndex="-1">{is3D ? study.title : category.title}</h1></div><span className="labs-experiment-mark" aria-hidden="true">({String((is3D ? studies.indexOf(study) : categories.indexOf(category)) + 1).padStart(2, '0')})</span></div>
      <p className="labs-description">{is3D ? study.description : category.description}</p>
      {is3D ? <><Stage key={active} study={study} settings={settings} paused={paused} reset={reset} apiRef={api} onState={setStageState} />
      <section className="labs-controls" aria-label="Study controls">
        <div className="labs-motion-controls"><button type="button" disabled={stageState !== 'ready'} onClick={() => setPaused(value => !value)}><span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>{paused ? 'Play motion' : 'Pause motion'}</button><button type="button" aria-label="Reset study" onClick={() => {setValues(previous => ({...previous, [active]: defaults()})); setReset(value => value + 1); setNotice('Study reset.');}}>↺ <span>Reset</span></button></div>
        <label className="labs-range" htmlFor="labs-speed"><span>Speed <output>{settings.speed.toFixed(2)}</output></span><input id="labs-speed" type="range" min="0" max="2" step="0.05" value={settings.speed} onChange={event => update('speed', Number(event.target.value))} /></label>
        <label className="labs-range" htmlFor="labs-intensity"><span>Intensity <output>{settings.intensity.toFixed(2)}</output></span><input id="labs-intensity" type="range" min="0.2" max="2" step="0.05" value={settings.intensity} onChange={event => update('intensity', Number(event.target.value))} /></label>
        <fieldset className="labs-palette"><legend>Ink</legend>{palettes.map(color => <button type="button" key={color.name} aria-label={color.name} aria-pressed={settings.color === color.hex} style={{'--swatch': color.hex}} onClick={() => update('color', color.hex)} />)}</fieldset>
        <button className="labs-wireframe" type="button" disabled={active === 'elastic-grid'} title={active === 'elastic-grid' ? 'The elastic grid is already a wireframe.' : undefined} aria-pressed={active === 'elastic-grid' || settings.wireframe} onClick={() => update('wireframe', !settings.wireframe)}>Wireframe <span aria-hidden="true">{active === 'elastic-grid' || settings.wireframe ? '☑' : '□'}</span></button>
      </section>
      <footer className="labs-study-footer"><p><span className="labs-eyebrow">POSSIBLE DIRECTIONS</span>{study.note}</p><button type="button" disabled={stageState !== 'ready'} onClick={save}>Save image <span aria-hidden="true">↓</span></button></footer>
      </> : categoryExperiences.length > 0 ? <section className="labs-experience-list" aria-label={category.title + ' experiments'}>{categoryExperiences.map(experience => <article className="labs-experience-card" key={experience.id}><img src={experience.poster} alt="" loading="lazy" /><div><span className="labs-eyebrow">PROTOTYPE</span><h2>{experience.title}</h2><p>{experience.description}</p><button type="button" className="labs-launch" onClick={event => {experienceLauncher.current = event.currentTarget; setPaused(true); setActiveExperienceId(experience.id);}}>Open {experience.title} ↗</button></div></article>)}</section> : <section className="labs-empty" aria-label={category.title + ' experiments'}><span className="labs-eyebrow">AN OPEN SPACE</span><h2>No experiments yet.</h2><p>{category.empty}</p></section>}
      <p className="labs-notice" role="status">{notice}</p>
    </main>
    {activeExperienceId && <ExperienceModal experience={experiences.find(item => item.id === activeExperienceId)} returnFocusRef={experienceLauncher} onClose={closeExperience} />}
  </div>;
}

function Labs() {
  const [loggedIn, setLoggedIn] = useState(hasSession);
  return loggedIn ? <Workspace onLogout={() => {try {sessionStorage.removeItem(sessionKey);} catch { /* Session may be unavailable. */ } setLoggedIn(false); document.title = 'Labs — ROOM';}} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

createRoot(document.getElementById('labs-root')).render(<Labs />);
