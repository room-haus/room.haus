import {useCallback, useImperativeHandle, useLayoutEffect, useRef} from 'react';
import type {Ref} from 'react';
import type {AudioFrame, Dungeon, EncounterSnapshot, Mode, Pose, WorldResponse} from '../contracts';
import {ENEMIES} from '../interaction/EncounterController';

const glyphs: Record<string, string[]> = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
};

export function DungeonTitle() {
  const title = 'THE UNDERLEVEL';
  return <>
    <span className="ul-sr">The Underlevel</span>
    <svg className="ul-pixel-title" aria-hidden="true" viewBox={`0 0 ${title.length * 6 - 1} 7`} shapeRendering="crispEdges">
      {Array.from(title).flatMap((letter, index) => (glyphs[letter] ?? []).flatMap((row, y) =>
        Array.from(row).map((bit, x) => bit === '1' &&
          <rect key={`${index}-${x}-${y}`} x={index * 6 + x} y={y} width="1" height="1" />)))}
    </svg>
  </>;
}

const bands = [
  {field: 'bass', title: 'Bass'},
  {field: 'mid', title: 'Mid'},
  {field: 'high', title: 'High'},
  {field: 'intensity', title: 'Power'},
] as const;

const SOURCE_LABELS = {live: 'Live', cue: 'Cue only', paused: 'Paused'} as const;
const METER_SEGMENTS = 8;

function estimatedTempo(audio: AudioFrame) {
  return audio.playing && audio.available && audio.beatConfidence >= .65 && audio.bpm > 0
    ? Math.round(audio.bpm) : null;
}

export interface SignalMetersHandle {
  update(audio: AudioFrame, source: WorldResponse['source'], tempoPulse?: number): void;
}

export function SignalMeters({audio, source, ref}: {
  audio: AudioFrame; source: WorldResponse['source']; ref?: Ref<SignalMetersHandle>;
}) {
  const sourceLabel = useRef<HTMLSpanElement>(null);
  const meterList = useRef<HTMLDListElement>(null);
  const tempoLabel = useRef<HTMLParagraphElement>(null);
  const tempoValue = useRef<HTMLSpanElement>(null);
  const beatLamp = useRef<HTMLSpanElement>(null);

  const update = useCallback<SignalMetersHandle['update']>((frame, nextSource, tempoPulse) => {
    const label = sourceLabel.current;
    if (label && label.dataset.source !== nextSource) {
      label.dataset.source = nextSource;
      label.textContent = SOURCE_LABELS[nextSource];
    }

    const meters = meterList.current?.querySelectorAll<HTMLElement>('[role="meter"]');
    bands.forEach(({field}, index) => {
      const meter = meters?.[index];
      if (!meter) return;
      const level = nextSource === 'live'
        ? Math.round(Math.max(0, Math.min(1, frame[field])) * METER_SEGMENTS) : 0;
      const levelText = nextSource === 'live' ? `${level} of ${METER_SEGMENTS}` : 'No live measurement';
      if (meter.getAttribute('aria-valuetext') === levelText) return;
      meter.setAttribute('aria-valuenow', String(level));
      meter.setAttribute('aria-valuetext', levelText);
      Array.from(meter.children).forEach((segment, index) => {
        (segment as HTMLElement).dataset.lit = String(index < level);
      });
    });

    const tempo = estimatedTempo(frame);
    const text = tempo === null ? '---' : String(tempo);
    if (tempoValue.current?.textContent !== text && tempoLabel.current && tempoValue.current) {
      tempoValue.current.textContent = text;
      tempoLabel.current.setAttribute('aria-label', tempo === null ? 'Tempo estimate unavailable' : `Estimated tempo ${tempo} BPM`);
    }

    if (beatLamp.current && (tempoPulse !== undefined || tempo === null)) {
      const beat = String(tempo !== null && nextSource === 'live' && (tempoPulse ?? 0) > .1);
      if (beatLamp.current.dataset.beat !== beat) beatLamp.current.dataset.beat = beat;
    }
  }, []);

  useImperativeHandle(ref, () => ({update}), [update]);
  useLayoutEffect(() => { update(audio, source); }, [audio, source, update]);

  return <section className="ul-meter-board" aria-label="Audio signal meters">
    <div className="ul-board-heading">
      <strong>Signal</strong>
      <span ref={sourceLabel} />
    </div>
    <dl ref={meterList}>
      {bands.map(({field, title}) => (
        <div key={field} className="ul-meter" data-band={field}>
          <dt>{title}</dt>
          <dd role="meter" aria-label={title} aria-valuemin={0} aria-valuemax={METER_SEGMENTS} aria-valuenow={0}>
            {Array.from({length: METER_SEGMENTS}, (_, index) => <span key={index} aria-hidden="true" />)}
          </dd>
        </div>
      ))}
    </dl>
    <p className="ul-tempo" ref={tempoLabel}>
      <span>BPM EST</span> <span className="ul-tempo-value"><span ref={tempoValue} /><span ref={beatLamp} className="ul-beat-lamp" aria-hidden="true" /></span>
    </p>
  </section>;
}

const listenerPortrait = [
  '....uuu....',
  '...uuuuu...',
  '..uu...uu..',
  '..u.sss.u..',
  '.cc.sss.cc.',
  '.cc.ese.cc.',
  '.cc.sss.cc.',
  '..u..s..u..',
  '...vsvvv...',
  '..vvvvvvv..',
  '.vvvvvvvvv.',
] as const;

export function PlayerCard({mode, mana, audio, reducedMotion}: {
  mode: Mode; mana: number; audio: AudioFrame; reducedMotion: boolean;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, mana)) * 100);
  return <section className="ul-player-card" aria-label="Player character"
    data-tempo={!reducedMotion && estimatedTempo(audio) !== null}>
    <div className="ul-board-heading"><strong>You</strong><span>Listener</span></div>
    <div className="ul-player-card-body">
      <svg className="ul-listener-portrait" aria-hidden="true" viewBox="0 0 11 11" shapeRendering="crispEdges">
        {listenerPortrait.flatMap((row, y) => Array.from(row).map((pixel, x) => pixel !== '.' &&
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" data-pixel={pixel} />))}
      </svg>
      <dl className="ul-player-stats">
        <div><dt className="ul-sr">Player health (no automatic damage)</dt><dd className="ul-player-hp">HP 3/3</dd></div>
        <div><dt className="ul-sr">Shared mana</dt><dd className="ul-player-mp">MP {percent}</dd></div>
      </dl>
    </div>
    <p className="ul-player-mode"><span className="ul-sr">Navigation mode </span>{mode}</p>
  </section>;
}

export function DungeonMap({world, pose}: {world: Dungeon; pose: Pose}) {
  const x = Math.round(pose.x / world.tileSize);
  const z = Math.round(pose.z / world.tileSize);
  return <section className="ul-map-board" aria-label="Dungeon map">
    <strong>Map</strong>
    <svg role="img" aria-label={`Current tile ${x}, ${z}`} viewBox="-12 -56 27 59" shapeRendering="crispEdges">
      {world.tiles.map(tile => (
        <rect key={`${tile.x},${tile.z}`} x={tile.x * 4} y={-tile.z * 4} width="3" height="3"
          data-current={x === tile.x && z === tile.z} data-zone={tile.zone} />
      ))}
    </svg>
    <span className="ul-coordinates" aria-hidden="true">{x}, {z}</span>
  </section>;
}

const portraits = {
  bone: ['..11111..', '.1111111.', '.1101011.', '.1000001.', '.1111111.', '..10101..', '...111...', '111111111', '..11111..'],
  eye: ['....1....', '..11111..', '.1111111.', '110010011', '100111001', '110010011', '.1111111.', '..11111..', '....1....'],
  moth: ['1.......1', '111...111', '1111.1111', '.1111111.', '..11111..', '.0111110.', '.1111111.', '11..1..11', '....1....'],
};

function CreaturePortrait({kind}: {kind: keyof typeof portraits}) {
  return <svg className="ul-creature-portrait" data-kind={kind} aria-hidden="true" viewBox="0 0 11 11" shapeRendering="crispEdges">
    {portraits[kind].flatMap((row, y) => Array.from(row).map((bit, x) => bit === '1' &&
      <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" />))}
  </svg>;
}

export function EncounterPlate({encounters, mode, onEnemy}: {
  encounters: EncounterSnapshot; mode: Mode; onEnemy: (id: string) => void;
}) {
  const attack = mode === 'EXPLORE';
  const visible = encounters.enemies.filter(enemy => enemy.visible);
  return <section className="ul-target-board" aria-label="Enemy encounters">
    <div className="ul-board-heading"><strong>Encounter</strong></div>
    {visible.length === 0 && <p className="ul-no-target">No creature in view</p>}
    {visible.map(enemy => {
      const definition = ENEMIES.find(item => item.id === enemy.id);
      if (!definition) return null;
      const accessibleName = definition.name[0] + definition.name.slice(1).toLowerCase();
      return <div key={enemy.id} className="ul-target" data-selected={enemy.id === encounters.selectedId}
          data-reacting={enemy.reaction > 0}>
        <CreaturePortrait kind={definition.kind} />
        <div className="ul-target-info">
          <strong>{definition.name}</strong>
          <span className="ul-target-band">{definition.signal}</span>
          {attack && <div className="ul-health" role="meter"
            aria-label={`Health ${enemy.health} of ${enemy.maxHealth}`}
            aria-valuemin={0} aria-valuemax={enemy.maxHealth} aria-valuenow={enemy.health}>
            <span aria-hidden="true">HP {enemy.health}/{enemy.maxHealth}</span>
            <div className="ul-health-bar" aria-hidden="true">
              {Array.from({length: enemy.maxHealth}, (_, index) =>
                <span key={index} data-lit={index < enemy.health} />)}
            </div>
          </div>}
        </div>
        <button type="button" className="ul-target-action" aria-label={`${attack ? 'Attack' : 'Provoke'} ${accessibleName}`}
          onClick={() => onEnemy(enemy.id)}>{attack ? 'Attack' : 'Provoke'}</button>
      </div>;
    })}
    <p className="ul-encounter-log" role="status">{encounters.reaction > 0 ? encounters.message : ''}</p>
  </section>;
}

export function ManaPlate({mana, onCast, canCast, mode, source}: {
  mana: number; onCast: () => void; canCast: boolean; mode: Mode; source: WorldResponse['source'];
}) {
  const percent = Math.round(Math.max(0, Math.min(1, mana)) * 100);
  return <section className="ul-mana-board" aria-label="Static spell">
    <div className="ul-board-heading"><strong>Mana</strong><span aria-hidden="true">{percent}%</span></div>
    <meter className="ul-mana-bar" min={0} max={100} value={percent} aria-label="Mana charge" />
    <p className="ul-mana-note" aria-hidden="true">
      <span>{source === 'live' ? 'MID -> MP' : source === 'paused' ? 'MP HELD' : 'NO LIVE MP'}</span>
      <span>COST 60%</span>
      <span>TARGET REQ</span>
      {mode !== 'EXPLORE' && <span>EXPLORE REQ</span>}
    </p>
    <p className="ul-sr" id="ul-static-description">
      {source === 'live' ? 'Midrange audio charges mana.' : 'Mana charge is held while live analysis is unavailable.'}
      {' '}Casting Static bends the dungeon light. It requires 60% mana, a creature in view, and Explore mode.
    </p>
    <button type="button" className="ul-target-action ul-cast" aria-label="Cast static" aria-describedby="ul-static-description"
      disabled={mode !== 'EXPLORE' || !canCast} onClick={onCast}>Cast</button>
  </section>;
}

export function SignalMap() {
  return <details className="ul-signal-map">
    <summary>Signal map</summary>
    <dl>
      <div><dt>Bass</dt><dd>Bass and sub brighten lanterns. Bass moves the Bone Listener.</dd></div>
      <div><dt>Mid</dt><dd>Mids light the transmitter runes, change the Hollow Eye’s pupil, and charge the Static spell.</dd></div>
      <div><dt>High</dt><dd>Highs stir dust and move the Ash Moth’s wings.</dd></div>
      <div><dt>Power</dt><dd>Sustained intensity and brightness change the fog.</dd></div>
      <div><dt>Tempo</dt><dd>A confident tempo estimate sets the torch pulse, creature cadence, transmitter breath, rune and dust accents, and your headphone glint.</dd></div>
      <div><dt>Cues</dt><dd>The mix opens the gate at 1:18. With no live analysis, cues guide the atmosphere.</dd></div>
    </dl>
    <p><strong>DRIFT</strong> follows the mix. <strong>STILL</strong> holds the camera. In either mode, select a creature to provoke a reaction.</p>
    <p><strong>EXPLORE</strong> lets you move freely and attack. Three hits disperse a creature for this loop. Encounters are optional.</p>
    <p><strong>CAST STATIC</strong> bends the dungeon light. It requires Explore mode, 60% mana, and a creature in view.</p>
  </details>;
}
