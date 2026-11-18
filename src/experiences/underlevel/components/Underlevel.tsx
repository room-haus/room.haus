import {useCallback, useEffect, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {mediaUrl} from '../../../content/media.mjs';
import {AudioController} from '../audio/AudioController';
import {emptyAudioFrame} from '../audio/FeatureExtractor';
import type {AudioFrame, Direction, DirectorState, EncounterSnapshot, Mode, NavigationState, PlaybackSnapshot, SceneHandle, SceneMetrics, WorldResponse} from '../contracts';
import {mix} from '../data/mx029';
import {ExperienceDirector, resolveGateClearance} from '../director/ExperienceDirector';
import {NarrationDirector} from '../director/Narration';
import type {Narration} from '../director/Narration';
import {EncounterController} from '../interaction/EncounterController';
import {mapSignals} from '../interaction/SignalMapper';
import {createDungeon} from '../world/DungeonGraph';
import {NavigationController} from '../world/NavigationController';
import {horizontalViewHalfAngle} from '../view';
import poster from '../assets/threshold.png';
import {DungeonMap, DungeonTitle, EncounterPlate, ManaPlate, PlayerCard, SignalMap, SignalMeters} from './DungeonHud';
import type {SignalMetersHandle} from './DungeonHud';
import {elapsedTime, Player} from './Player';

const modes: Mode[] = ['DRIFT', 'EXPLORE', 'STILL'];
const directions: {direction: Direction; icon: string; label: string}[] = [
  {direction: 'left', icon: '←', label: 'Turn left'},
  {direction: 'forward', icon: '↑', label: 'Move forward'},
  {direction: 'back', icon: '↓', label: 'Move back'},
  {direction: 'right', icon: '→', label: 'Turn right'},
];
const keys = new Map<string, Direction>([
  ['arrowup', 'forward'], ['w', 'forward'],
  ['arrowdown', 'back'], ['s', 'back'],
  ['arrowleft', 'left'], ['a', 'left'],
  ['arrowright', 'right'], ['d', 'right'],
]);

const initialPlayback: PlaybackSnapshot = {playing: false, status: 'idle', time: 0, duration: 0, error: null};
const world = createDungeon(mix.seed);
const audioUrl = mediaUrl(mix.audioPath);
const archiveUrl = `/mixes/${mix.id}/`;
type SceneState = 'loading' | 'ready' | 'fallback';

interface Diagnostics {
  audio: AudioFrame;
  director: DirectorState;
  navigation: NavigationState;
  metrics: SceneMetrics | null;
  encounters: EncounterSnapshot;
  response: WorldResponse;
  narration: Narration | null;
}

const signalFields = ['rms', 'sub', 'bass', 'lowMid', 'mid', 'high', 'brightness', 'intensity', 'bpm', 'beatConfidence'] as const;

function copyEncounters(snapshot: EncounterSnapshot): EncounterSnapshot {
  return {...snapshot, enemies: snapshot.enemies.map(enemy => ({...enemy}))};
}

function initialDiagnostics(reduced: boolean): Diagnostics {
  const audio = emptyAudioFrame();
  const director = new ExperienceDirector().update(audio);
  const navigation = new NavigationController(world, reduced).update(0, 0, director, reduced);
  const encounters = new EncounterController(world).update(audio, navigation, reduced, 0, 0, director.gateOpen);
  return {audio, director, navigation, encounters, response: mapSignals(audio, director, encounters, reduced, 0), metrics: null, narration: null};
}

function SignalPanel({id, diagnostics}: {id: string; diagnostics: Diagnostics}) {
  const {audio, metrics} = diagnostics;
  return (
    <aside id={id} className="ul-signal" aria-label="Signal diagnostics">
      <div className="ul-label">{audio.available ? 'Live analysis' : 'Analysis unavailable'} · {elapsedTime(audio.time)}</div>
      <dl>
        {signalFields.map(field => (
          <div key={field}><dt>{field}</dt><dd>{audio.available ? audio[field].toFixed(2) : '—'}</dd></div>
        ))}
        <div><dt>FPS</dt><dd>{metrics ? Math.round(metrics.fps) : '—'}</dd></div>
        <div><dt>Draw calls</dt><dd>{metrics?.drawCalls ?? '—'}</dd></div>
      </dl>
    </aside>
  );
}

export function Underlevel({onClose}: {onClose: () => void}) {
  const [entered, setEntered] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [mode, setMode] = useState<Mode>(reduced ? 'STILL' : 'DRIFT');
  const [motion, setMotion] = useState(0.7);
  const [volume, setVolume] = useState(1);
  const [debug, setDebug] = useState(false);
  const [diagnostics, setDiagnostics] = useState(() => initialDiagnostics(reduced));
  const [playback, setPlayback] = useState(initialPlayback);
  const [nativeOnly, setNativeOnly] = useState(false);
  const [sceneState, setSceneState] = useState<SceneState>('loading');
  const [sceneAttempt, setSceneAttempt] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);
  const nativeHost = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle>(null);
  const audioRef = useRef<AudioController>(null);
  const navigationRef = useRef<NavigationController>(null);
  const encounterRef = useRef<EncounterController>(null);
  const narrationRef = useRef<NarrationDirector>(null);
  const metersRef = useRef<SignalMetersHandle>(null);
  const latestSignals = useRef({audio: diagnostics.audio, director: diagnostics.director});
  const latestNavigation = useRef(diagnostics.navigation);
  const preferences = useRef({motion, reduced, debug});
  const debugRequest = useRef(false);
  const requestedSeek = useRef(false);
  const reducedOverride = useRef(false);
  const returnsToEntry = useRef(false);

  const viewAngle = useCallback(() => horizontalViewHalfAngle(
    canvasRef.current?.clientWidth ?? 4, canvasRef.current?.clientHeight ?? 3,
  ), []);

  const activateEnemy = useCallback((id: string) => {
    const encounters = encounterRef.current;
    const navigation = navigationRef.current;
    if (!encounters || !navigation) return;
    encounters.activate(id, navigation.mode);
    const {audio, director} = latestSignals.current;
    const {reduced, motion} = preferences.current;
    const current = {...latestNavigation.current, mode: navigation.mode};
    const snapshot = copyEncounters(encounters.update(audio, current, reduced, motion, 0, director.gateOpen, viewAngle()));
    setDiagnostics(previous => ({...previous, encounters: snapshot}));
  }, [viewAngle]);

  const castStatic = useCallback(() => {
    const encounters = encounterRef.current;
    const navigation = navigationRef.current;
    if (!encounters || !navigation || !encounters.cast(navigation.mode)) return;
    const {audio, director} = latestSignals.current;
    const {reduced, motion} = preferences.current;
    const snapshot = copyEncounters(encounters.update(audio, {...latestNavigation.current, mode: navigation.mode},
      reduced, motion, 0, director.gateOpen, viewAngle()));
    setDiagnostics(previous => ({...previous, encounters: snapshot}));
  }, [viewAngle]);

  useEffect(() => { enterRef.current?.focus(); }, []);

  useEffect(() => {
    // The renderer may be fetched early. The audio element and its context are
    // created only when visitors select the entry action.
    void import('../render/BabylonScene').catch(() => {});
  }, []);

  useEffect(() => () => {
    audioRef.current?.dispose();
    audioRef.current = null;
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduced = (event: MediaQueryListEvent) => {
      if (reducedOverride.current) return;
      const next = event.matches;
      preferences.current.reduced = next;
      setReduced(next);
      if (next) {
        navigationRef.current?.setMode('STILL');
        setMode('STILL');
        setDiagnostics(previous => ({...previous, navigation: {...latestNavigation.current, mode: 'STILL', resumeOffered: false}}));
      } else if (!navigationRef.current) {
        setMode('DRIFT');
      }
    };
    query.addEventListener('change', updateReduced);
    return () => query.removeEventListener('change', updateReduced);
  }, []);

  useEffect(() => {
    if (entered) sceneHeadingRef.current?.focus();
    else if (returnsToEntry.current) enterRef.current?.focus();
  }, [entered, viewAngle]);

  useEffect(() => {
    if (!entered || sceneState !== 'loading' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let cancelled = false;
    let failed = false;
    let scene: SceneHandle | undefined;
    const fallback = () => {
      if (cancelled || failed) return;
      failed = true;
      sceneRef.current = null;
      setSceneState('fallback');
      // Shader errors can be dispatched from inside a render call.
      queueMicrotask(() => scene?.dispose());
    };

    void import('../render/BabylonScene').then(({createBabylonScene}) => {
      if (cancelled) return;
      scene = createBabylonScene(canvas, world, fallback, activateEnemy);
      if (!failed) {
        sceneRef.current = scene;
        setSceneState('ready');
      }
    }).catch(fallback);

    return () => {
      cancelled = true;
      if (sceneRef.current === scene) sceneRef.current = null;
      scene?.dispose();
    };
  }, [entered, sceneAttempt, activateEnemy]);

  const native = sceneState === 'fallback' || nativeOnly;
  useEffect(() => {
    const host = nativeHost.current;
    const audio = audioRef.current;
    if (!entered || !audio) return;
    let attached: HTMLAudioElement | null = null;
    let observed: HTMLAudioElement | null = null;
    const markSeek = () => { requestedSeek.current = true; };
    const observeSeeks = (media: HTMLAudioElement | null) => {
      if (media === observed) return;
      observed?.removeEventListener('seeked', markSeek);
      observed = media;
      observed?.addEventListener('seeked', markSeek);
    };
    const syncVolume = () => {
      if (!attached) return;
      setVolume(attached.volume);
      audio.setVolume(attached.volume);
    };
    const detachNative = () => {
      if (!attached) return;
      attached.removeEventListener('volumechange', syncVolume);
      attached.controls = false;
      attached.remove();
      attached = null;
    };
    const refresh = () => {
      const media = audio.source.media ?? null;
      observeSeeks(media);
      if (!host) return;
      if (media === attached) return;
      detachNative();
      if (media) {
        attached = media;
        media.controls = true;
        media.addEventListener('volumechange', syncVolume);
        host.appendChild(media);
      }
    };
    audio.onChange = snapshot => {
      refresh();
      // Media timeupdates are sampled in the frame loop. Loading and errors
      // get immediate feedback, including while the tab is hidden.
      if (snapshot.status === 'error' || snapshot.status === 'loading') setPlayback(snapshot);
    };
    refresh();
    return () => {
      audio.onChange = undefined;
      observeSeeks(null);
      detachNative();
    };
  }, [entered, native]);

  useEffect(() => {
    const audio = audioRef.current;
    const navigation = navigationRef.current;
    const encounters = encounterRef.current;
    const storyteller = narrationRef.current;
    if (!entered || !audio || !navigation || !encounters || !storyteller) return;

    const director = new ExperienceDirector();
    let frameRequest = 0;
    let previous = 0;
    let publishedAt = -Infinity;
    let meteredAt = -Infinity;
    let mediaTime = 0;
    let pose = latestNavigation.current.pose;

    const render = (now: number) => {
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      const frame = audio.sample(delta);
      const media = audio.source.media;
      // The media clock also stays authoritative after a hidden tab was paused
      // by native controls. A paused clock holds DRIFT without losing seek state.
      mediaTime = frame.time;
      if (requestedSeek.current) {
        encounters.reset();
        storyteller.reset();
      }
      requestedSeek.current = false;
      const chapter = resolveGateClearance(director.update(frame), pose, world);
      const settings = preferences.current;
      const current = navigation.update(mediaTime, navigation.mode === 'EXPLORE' || frame.playing ? delta : 0, chapter, settings.reduced);
      pose = current.pose;
      latestNavigation.current = current;
      latestSignals.current = {audio: frame, director: chapter};
      const encounterSnapshot = encounters.update(frame, current, settings.reduced, settings.motion, delta, chapter.gateOpen, viewAngle());
      const response = mapSignals(frame, chapter, encounterSnapshot, settings.reduced, settings.motion);
      const narration = storyteller.update({audio: frame, director: chapter, navigation: current, encounters: encounterSnapshot});
      if (now - meteredAt >= 80) {
        metersRef.current?.update(frame, response.source, response.tempoPulse);
        meteredAt = now;
      }
      const scene = sceneRef.current;
      try {
        scene?.update({audio: frame, director: chapter, navigation: current, reducedMotion: settings.reduced,
          motion: settings.motion, delta: frame.playing ? delta : 0, response, encounters: encounterSnapshot});
      } catch {
        sceneRef.current = null;
        scene?.dispose();
        setSceneState('fallback');
      }

      if (now - publishedAt >= 500 || debugRequest.current) {
        debugRequest.current = false;
        publishedAt = now;
        const snapshot = audio.snapshot();
        setPlayback(snapshot);
        setNativeOnly(Boolean(media && !audio.source.analyser));
        setDiagnostics({audio: {...frame}, director: chapter, navigation: current,
          metrics: settings.debug ? scene?.metrics() ?? null : null, response, encounters: copyEncounters(encounterSnapshot), narration});
      }
      frameRequest = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      cancelAnimationFrame(frameRequest);
      previous = 0;
      if (!document.hidden) {
        publishedAt = -Infinity;
        frameRequest = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(frameRequest);
    };
  }, [entered]);

  const enter = () => {
    const audio = new AudioController(audioUrl);
    audioRef.current = audio;
    audio.setVolume(volume);
    navigationRef.current = new NavigationController(world, reduced);
    encounterRef.current = new EncounterController(world);
    narrationRef.current = new NarrationDirector(world);
    setMode(reduced ? 'STILL' : 'DRIFT');
    const initial = initialDiagnostics(reduced);
    latestNavigation.current = initial.navigation;
    setDiagnostics(initial);
    setSceneState('loading');
    requestedSeek.current = false;
    audio.play();
    setPlayback(audio.snapshot());
    setEntered(true);
  };

  const exit = () => {
    returnsToEntry.current = true;
    audioRef.current?.pause();
    audioRef.current?.dispose();
    audioRef.current = null;
    navigationRef.current = null;
    encounterRef.current = null;
    narrationRef.current = null;
    setNativeOnly(false);
    setEntered(false);
    onClose();
  };

  const chooseMode = (next: Mode) => {
    navigationRef.current?.setMode(next);
    setMode(next);
    setDiagnostics(previous => ({
      ...previous,
      navigation: {...latestNavigation.current, mode: next, resumeOffered: false},
    }));
  };

  const toggleReduced = () => {
    reducedOverride.current = true;
    const next = !reduced;
    preferences.current.reduced = next;
    setReduced(next);
    if (next) chooseMode('STILL');
    else if (!entered) setMode('DRIFT');
  };

  const move = (direction: Direction) => {
    const navigation = navigationRef.current;
    if (!navigation || navigation.mode === 'STILL') return;
    navigation.input(direction, performance.now() / 1000);
    setMode(navigation.mode);
  };

  const onCanvasKey = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = keys.get(event.key.toLowerCase());
    if (!direction || mode === 'STILL') return;
    event.preventDefault();
    move(direction);
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const snapshot = audio.snapshot();
    if (snapshot.playing || snapshot.status === 'loading') audio.pause();
    else audio.play();
    setPlayback(audio.snapshot());
  };

  const seek = (seconds: number) => {
    requestedSeek.current = true;
    audioRef.current?.seek(seconds);
    if (audioRef.current) setPlayback(audioRef.current.snapshot());
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    audioRef.current?.setVolume(next);
  };

  const retryScene = () => {
    setSceneState('loading');
    setSceneAttempt(attempt => attempt + 1);
    sceneHeadingRef.current?.focus();
  };

  const toggleDebug = () => {
    preferences.current.debug = !debug;
    debugRequest.current = !debug;
    setDebug(!debug);
  };

  const selectedEnemy = diagnostics.encounters.enemies.find(enemy => enemy.id === diagnostics.encounters.selectedId);
  const narration = diagnostics.narration;
  return (
    <main className={entered ? 'ul-shell ul-shell--inside' : 'ul-shell'}>
      {!entered && <header className="ul-header">
        <span className="ul-wordmark">ROOM / LABS</span>
        <button type="button" aria-label="Exit Underlevel" onClick={onClose}>Back to Labs</button>
      </header>}

      {!entered ? (
        <>
          <section className="ul-cover" aria-labelledby="underlevel-title">
            <img src={poster} alt="" className="ul-poster" fetchPriority="high" />
            <div className="ul-cover-copy">
              <p className="ul-kicker">A place beneath ROOM.</p>
              <h1 id="underlevel-title"><DungeonTitle /></h1>
              <p>Follow the mix through a space that changes with the sound. You can leave the journey to the music.</p>
              <button ref={enterRef} type="button" className="ul-enter" onClick={enter}>
                <span>Enter / play mix</span><span aria-hidden="true">↘</span>
              </button>
            </div>
          </section>
          <footer className="ul-entry-footer">
            <a href={archiveUrl}>{mix.id} <span aria-hidden="true">/</span> {mix.artist} <span aria-hidden="true">↗</span></a>
            <button className="ul-text-button" type="button" aria-pressed={reduced} onClick={toggleReduced}>Reduced motion</button>
          </footer>
        </>
      ) : (
        <>
          <div className="ul-console" data-view={sceneState === 'ready' ? 'dungeon' : 'poster'}>
            <div className="ul-chapter-bar">
              <h1 ref={sceneHeadingRef} tabIndex={-1}><DungeonTitle /></h1>
              <p className="ul-label">{diagnostics.director.chapter} <span className="ul-mode-tag">{mode}</span></p>
              <button type="button" className="ul-exit" aria-label="Exit Underlevel" onClick={exit}>Exit</button>
            </div>
            <section className="ul-stage" aria-label="Underlevel scene"
              data-mode={mode} data-chapter={diagnostics.director.chapter} data-gate={diagnostics.director.gateOpen.toFixed(3)}
              data-audio-rms={diagnostics.audio.rms.toFixed(3)} data-time={diagnostics.audio.time.toFixed(2)}
              data-pose={JSON.stringify(diagnostics.navigation.pose)} data-render-state={sceneState}
              data-enemy={selectedEnemy?.id ?? ''} data-enemy-health={selectedEnemy?.health}
              data-reaction={diagnostics.encounters.reaction > 0 ? diagnostics.encounters.message : ''}
              data-signal-source={diagnostics.response.source} data-mana={diagnostics.encounters.mana?.toFixed(3)}
              data-tempo-pulse={diagnostics.response.tempoPulse.toFixed(3)}
              data-tempo-color={diagnostics.response.tempoColor.toFixed(3)}
              data-bpm={diagnostics.audio.bpm.toFixed(2)} data-beat-confidence={diagnostics.audio.beatConfidence.toFixed(3)}>
              {sceneState !== 'ready' && <img src={poster} className="ul-poster" alt="" />}
              {sceneState !== 'fallback' && (
                <canvas key={sceneAttempt} ref={canvasRef} className="ul-canvas" tabIndex={sceneState === 'ready' ? 0 : -1}
                  aria-label="Dungeon view. Use arrow keys or W, A, S, D to navigate." onKeyDown={onCanvasKey} />
              )}
              {sceneState === 'loading' && <p className="ul-scene-note" role="status">Opening the Underlevel…</p>}
              {sceneState === 'fallback' && <div className="ul-scene-note">
                <p role="status">The 3D scene is unavailable. You can still listen to the mix.</p>
                <button className="ul-text-button" type="button" onClick={retryScene}>Retry 3D scene</button>
              </div>}
              {sceneState === 'ready' && diagnostics.navigation.resumeOffered && mode === 'EXPLORE' && !reduced &&
                <button className="ul-text-button ul-resume" type="button" onClick={() => chooseMode('DRIFT')}>Resume drift</button>}
              {debug && <SignalPanel id="ul-diagnostics" diagnostics={diagnostics} />}
            </section>

            {sceneState === 'ready' && <section className="ul-navigation" aria-label="Scene navigation">
              <div className="ul-mode" role="group" aria-label="Camera mode">
                {modes.map(option => <button key={option} type="button" aria-pressed={mode === option}
                  disabled={reduced && option === 'DRIFT'} onClick={() => chooseMode(option)}>{option}</button>)}
              </div>
              <div className="ul-arrows" role="group" aria-label="Dungeon movement">
                {directions.map(({direction, icon, label}) =>
                  <button key={direction} type="button" aria-label={label} disabled={mode === 'STILL'}
                    onClick={() => move(direction)}>{icon}</button>)}
              </div>
            </section>}

            <section className="ul-story" aria-label="Dungeon messages" aria-live="off" data-message-id={narration?.id ?? ''} data-message-kind={narration?.kind ?? ''}>
              <p>{narration?.text ?? '\u00a0'}</p>
            </section>

            {sceneState === 'ready' && <aside className="ul-party" aria-label="Encounter console">
              <PlayerCard mode={mode} mana={diagnostics.encounters.mana} audio={diagnostics.audio} reducedMotion={reduced} />
              <EncounterPlate encounters={diagnostics.encounters} mode={mode} onEnemy={activateEnemy} />
              <ManaPlate mana={diagnostics.encounters.mana} mode={mode} onCast={castStatic}
                source={diagnostics.response.source}
                canCast={diagnostics.encounters.mana >= .6 && Boolean(selectedEnemy)} />
            </aside>}

            {sceneState === 'ready' && <aside className="ul-instruments" aria-label="Dungeon instruments">
              <DungeonMap world={world} pose={diagnostics.navigation.pose} />
              <SignalMeters ref={metersRef} audio={diagnostics.audio} source={diagnostics.response.source} />
            </aside>}

            <div className="ul-weather-line" aria-label="Dungeon status">
              <span>Visitor / Unverified</span><span>Door weather / Indoor rain</span>
            </div>

            <Player playback={playback} native={native} volume={volume} onToggle={togglePlayback} onSeek={seek}
              onVolume={changeVolume} nativeHost={nativeHost} />
            {playback.error && <div className="ul-feedback">
              <p role="status">{playback.error}</p>
              <button className="ul-text-button" type="button" onClick={togglePlayback}>Retry mix</button>
              <a href={archiveUrl}>Open mix in archive ↗</a>
            </div>}
            {playback.status === 'loading' && <p className="ul-feedback ul-label" role="status">Connecting to the mix…</p>}

            <SignalMap />

            <footer className="ul-settings">
              <button className="ul-text-button" type="button" aria-pressed={reduced} onClick={toggleReduced}>Reduced motion</button>
              <label className="ul-motion">
                <span className="ul-label">Motion amount</span>
                <input type="range" min={0} max={1} step="0.05" value={motion} disabled={reduced}
                  aria-valuetext={`${Math.round(motion * 100)}%`} onChange={event => {
                    preferences.current.motion = event.currentTarget.valueAsNumber;
                    setMotion(preferences.current.motion);
                  }} />
              </label>
              <button className="ul-text-button ul-debug" type="button" aria-expanded={debug} aria-controls={debug ? 'ul-diagnostics' : undefined}
                onClick={toggleDebug}>Diagnostics</button>
            </footer>
          </div>
        </>
      )}
    </main>
  );
}
