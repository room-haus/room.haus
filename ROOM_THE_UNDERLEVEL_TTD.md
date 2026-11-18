# ROOM — THE UNDERLEVEL
## Technical & Experiential Design Specification (TTD)

**Status:** Proposed v0.1\
**Target:** Web browser, desktop-first, mobile-compatible\
**Genre:** Passive/interactive first-person audiovisual dungeon crawler\
**Visual reference:** https://www.are.na/peter-markoski/dungeon-crawl-_v-pmazo6jw\
**Historical touchstones:** Dungeon Master, Eye of the Beholder, Ultima Underworld\
**Platform assumption:** Reuse ROOM's React + Babylon.js background; implement as an isolated experience, then integrate into ROOM.\
**Reference limitation:** The Are.na channel page was reachable but its individual blocks were not retrievable for this draft. Art direction below is a provisional interpretation of the linked board and cited genre.

---

## 1. Thesis

ROOM should feel like an unknown 1990s dungeon crawler reimagined as a listening room. The user enters a labyrinth while a DJ mix plays; architecture, light, fog, objects, and traversal respond to the evolving sound. It is a place to inhabit, not a game to beat.

**Key rule:** Music is both the score and the clock of the environment, but not an excuse for every object to bounce. Small musical events shape local details; major musical phrases and transitions shape the visitor's journey.

### Goals
1. Entirely enjoyable hands-off for the length of a mix.
2. Optional navigation that never interrupts or competes with listening.
3. Legible retro dungeon atmosphere with unusually refined contemporary art direction.
4. Meaningful real-time response to audio, especially the contrast between tension and release.
5. Browser performance and accessibility good enough for a public ROOM page.

### Non-goals in v1
Combat, inventories, enemies, quests, save files, procedural infinite terrain, multiplayer, true AI music understanding, full live-DJ integrations, VR, and a large level editor.

## 2. Core experience

### Entry
- A prerendered poster and minimal editorial text appear immediately.
- The visitor must press **ENTER / PLAY MIX** to unlock audio; audio must never autoplay.
- Load the lightweight scene in the background; offer a static visual fallback if WebGL is unavailable.
- Camera opens on a dim, low-ceilinged corridor. The mix begins and the space slowly breathes.

### Three states
- **DRIFT (default):** A cinematic autopilot walks a curated, looping route through the dungeon. It must survive any track or quiet section and must never become stuck. Passive viewing is the primary experience.
- **EXPLORE:** The visitor can temporarily steer using keyboard, on-screen controls, or touch. World changes remain governed by the soundtrack.
- **STILL:** Hold the camera at the current location while the mix and environmental responses continue.

When a visitor provides directional input in DRIFT, switch to EXPLORE and relinquish camera control immediately. After ~12 seconds without input, show a subtle **RESUME DRIFT** affordance and optionally resume with a soft transition, never a sudden snap. Allow a persistent manual mode.

### Navigation
- Use a tile/grid topology inspired by 1990s crawlers: turn in 90° increments and move one tile at a time, with 200–350 ms eased camera animations. Tune by feel.
- Keyboard: W / Up move forward; S / Down back; A / D or Left / Right turn. Optional pointer click on hotspots. On touch: large unobtrusive arrows or swipe to turn/advance.
- Never require reflex timing, puzzle completion, key collection, or knowledge of games.
- Avoid mandatory pointer lock and mouse-look in v1; this reinforces the period and simplifies mobile controls.
- Camera choreography includes small moments of looking, lingering, and slow arrival at a focal object.

### Narrative arc, without a linear story
1. **THRESHOLD:** Constrained corridor, distant light, first traces of sound.
2. **CATACOMBS:** Modular corridors and recesses, repeating geometry and shadows.
3. **TRANSMITTER:** A chamber with a mysterious sonic artifact, antennas, glyphs, or mechanical relic.
4. **THE HALL:** A larger spatial reveal, reserved for a musical phrase or transition.
5. **AFTERIMAGE:** A quieter path that loops naturally back to another chapter.

The loop must feel intentional, not like an endless generic maze. No mandatory ending.

## 3. Art direction

### Form
- Restrained low-polygon stone, plaster, oxidized metal, brick, grates, doors, stairs, arches, alcoves, and impossible monolithic objects.
- 64–128 px textures with deliberate roughness, pixel edges, limited palette, imperfect UV mapping, subtle dithering, and pronounced darkness.
- Composition should prioritize the center-frame vanishing point; use a restrained editorial UI rather than RPG inventory panels.
- Atmosphere: fog, darkness, discrete light pools, cut-outs, and unsettling scale changes.

### Palette and materials
- Foundation: deep charcoal, dirty brown, near-black blue, warm gray stone.
- Accents: oxidized red/oxblood, bruised violet, parchment ivory, sickly amber, occasional desaturated green.
- Avoid permanent neon and glossy science-fiction surfaces. Color gains emotional weight by appearing rarely.

### Postprocessing
- Pixelated internal render resolution (~480×270 desktop as a starting point, adaptable by device) upscaled with nearest-neighbor sampling, with a small optional native-resolution text overlay.
- Subtle palette quantization, ordered dithering, depth fog, and restrained vignette. Film grain optional, amplitude limited.
- No full-frame white flashes, constant camera shakes, aggressive bloom, or rapid-cut montage.

### Asset minimum for MVP
- 6–8 modular pieces: straight corridor, corner, junction, doorway, small chamber, large chamber, pillar/recess, hero object.
- 2 palette states, 3 material/texture families, 2 light styles, 1 fog system, 1 animated artifact.
- Make three hero screenshots before building a large asset library.

## 4. Sonic interaction design

**Four timescales** make the difference between a musical environment and a reactive screensaver.

| Timescale | Features | Allowed response |
|---|---|---|
| Sub-second | bass, transients, treble | torch intensity, emissive pulse, small surface movement, dust |
| Seconds | smoothed RMS, spectral brightness, low/mid ratio | fog density, color temperature, spatial tension, artifact behavior |
| Phrases (8–32 bars, approximate) | beat confidence + sustained feature changes | opening an arch, camera dwell, room reveal, transition to next authored zone |
| Mix sections (tens of seconds to minutes) | offline cues or confident sustained contrast | environment identity, scale, palette, chapter transitions |

### Candidate mappings (tuning values, not final aesthetics)

| Audio signal | Environmental behavior | Guardrail |
|---|---|---|
| Sub / kick (approx. 30–150 Hz) | faint stone displacement, lamp warmth or pulse, monument vibration | never full-screen zoom on each kick |
| Low-mid (150–500 Hz) | door/gate resonance, room shadow weight | slow easing |
| Midrange (500–2,000 Hz) | inscribed symbols, architectural seams, glowing relics | localized only |
| Highs (2,000–10,000 Hz) | suspended dust, reflective glints, fine texture detail | low brightness and low particle count |
| RMS / loudness | overall environmental intensity | rolling normalization, bounded |
| Spectral flux/onset | isolated ripples, chimes, lattice movement | cooldown and de-bouncing |
| Extended quiet/breakdown | fog, absence, slower movement, lights recede | do not force a jump cut |
| Credible phrase / section change | door opening, large hall reveal, altered route | must have confidence threshold and cooldown |

### Signal processing
- For v1 use `AnalyserNode` with an FFT size such as 2048 or 4096, 30–60 Hz feature sampling, and perceptually grouped bands. Measure RMS from time-domain samples.
- Normalize against a rolling baseline and track dynamics; do **not** map raw FFT bins directly to scene intensity or a mastered mix will remain constantly maxed out.
- Apply asymmetric smoothing (e.g., ~80 ms attack, ~400 ms release) and clamp outputs to [0, 1]. Values are tuning knobs, not physical truths.
- Transient detection: use spectral flux or energy novelty with an adaptive local threshold; debounce triggers. Do not equate bass peaks with reliable BPM estimation.
- Section/reveal detection: only respond to sustained changes (e.g., 8–16 seconds), optional beat/phrase confidence, and cooldown (~20–60 seconds). Fallback to an authored timed path when confidence is low.
- For prerecorded ROOM mixes, strongly prefer **offline cue analysis plus real-time reactive data**. Use beat/onset/RMS/brightness estimates, optionally hand-tag 4–8 musically significant moments; the cue track determines large reveals. Real-time FFT still controls the world continuously.
- For seeking, derive chapter state from audio `currentTime`, then reconstruct local effects instead of replaying stale events.
- Silent/paused playback freezes reactive events; the scene may retain a gentle ambient idle motion, clearly differentiated from reactive sound.

### Example event schema
```ts
type AudioFrame = {
  time: number; // HTMLAudioElement.currentTime
  rms: number;
  sub: number;
  bass: number;
  lowMid: number;
  mid: number;
  high: number;
  brightness: number;
  onset: number; // 0..1
  beatConfidence?: number;
};

type Cue = {
  id: string;
  time: number;
  kind: 'breakdown' | 'build' | 'drop' | 'transition' | 'outro';
  intensity: number;
  chapter?: string;
};

type WorldEvent = {
  id: string;
  time: number;
  type: 'light-pulse' | 'artifact-awaken' | 'open-gate' | 'reveal-room' | 'change-atmosphere';
  magnitude: number;
  targetId?: string;
};
```

### Example deterministic director rule
- On each audio frame: update local shader/material/light uniforms from smoothed band values.
- On a cue or confident long-term shift: enqueue a `WorldEvent` for the nearest safe architectural waypoint.
- If the camera is in EXPLORE, let the visitor reach that room naturally; do not teleport or forcibly rotate the camera.
- Use a fixed seeded dungeon layout per mix and deterministic cue IDs, so seeking and replaying the same mix give coherent results.

## 5. Architecture

```text
ROOM page / React shell
  ├── Entry poster, player chrome, accessibility & fallback
  ├── AudioController (single canonical audio element)
  │    ├── Web Audio analyser (live bands/RMS/onsets)
  │    └── CueTimeline (optional offline JSON, keyed by media time)
  ├── ExperienceDirector (world events, chapters, intensity)
  ├── DungeonGraph (authored zone graph + seeded room variants)
  ├── NavigationController (DRIFT / EXPLORE / STILL)
  └── BabylonScene
       ├── modular geometry / materials / textures
       ├── scene lights, fog, hero object
       ├── shader uniforms / event effects
       └── camera and route choreography
```

### Rendering and state
- Use TypeScript, React for DOM shell and Babylon.js for world rendering. Keep high-frequency feature buffers in mutable refs/engine-owned objects, not React rerenders.
- Keep the engine boundary strict. `AudioController` emits signal snapshots; `ExperienceDirector` emits semantic events; `BabylonScene` renders. Geometry must not directly know how music was decoded.
- Keep an asset manifest, world seed, cue JSON, palette tokens, and director config as replaceable data.
- Model the world as a connected graph of authored room modules rather than fully random geometry. Seed decor/material variation, not the essential journey.
- Camera auto-path should navigate the graph using collision-free waypoints. Long-form content can repeat chapters with alternate material/light states.

### Streaming and browser constraints
- Prefer a legally hosted, CORS-compatible MP3/AAC mix played by one `HTMLAudioElement` and inspected by a `MediaElementAudioSourceNode` / analyser.
- Build the graph only once per element and prevent double-routing/double-playback. Resume/unlock audio on an explicit click/tap.
- Cross-origin streams without the correct CORS permissions may play but provide **silence to the analyser**. Third-party embeds are not equivalent to having access to decoded PCM. In those cases, host a permitted file or rely on a precomputed feature timeline.
- Audio should not unexpectedly change EQ, gain, or perceived mix dynamics just because the world changes.
- On `pause`, `seeked`, `ended`, `visibilitychange`, and WebGL context loss, preserve a recoverable state. Release scene resources on teardown.
- Copyright/licensing for the mix and any samples/assets must be secured before public release.

### Suggested repository layout
```text
src/experiences/underlevel/
  components/UnderlevelExperience.tsx
  components/ExperienceControls.tsx
  audio/AudioController.ts
  audio/FeatureExtractor.ts
  audio/CueTimeline.ts
  director/ExperienceDirector.ts
  director/DirectorConfig.ts
  world/DungeonGraph.ts
  world/RoomCatalog.ts
  world/AutoPilot.ts
  render/BabylonScene.ts
  render/materials/
  render/effects/
  assets/
  data/mixes/
  test/fixtures/
```

## 6. Responsive, accessible, performant

- **Desktop:** edge-to-edge or large framed viewport; keyboard input; mouse can select objects, no mandatory pointer lock.
- **Mobile:** touch controls and a playable portrait composition; landscape can expand field of view. Do not simply crop desktop UI; rearrange overlays and respect safe areas.
- **Reduced motion:** stationary camera default, reduced parallax and transitions, minimal pulses; provide a visible toggle independent of OS preferences.
- **Photosensitivity:** avoid strobes entirely; meet WCAG's three-flashes-or-below-threshold criterion. Large bright full-screen pulses are prohibited.
- **Controls:** play/pause, volume, exit, motion intensity, and DRIFT/EXPLORE/STILL accessible by keyboard and labelled for assistive technology.
- **Fallback:** instant static poster and native audio player when WebGL fails; downloadable or text-based information about the mix remains accessible.
- **Targets:** 60 fps capable desktop; 30 fps mid-range mobile; stable sound through canvas quality scaling; no interaction-induced audio stutters. These are acceptance targets to test, not assumed guarantees.
- **Performance tactics:** instanced repeated modules, texture atlases, conservative draw calls, limited dynamic lights, short view distance/fog, on-demand loading, dynamic resolution, cleanup of GPU resources.

## 7. Implementation roadmap and handoffs

### Slice 0 — Feasibility / audiovisual spike
**Build:** Full-screen Babylon scene with one corridor and one altar; user-click audio playback of one authorized DJ mix; 4 bands + RMS graph and debug values; one restrained kick response and one mid/high response.
**Exit:** Controls, audio routing, CORS, sampling, and laptop/mobile frame rate verified. No polished maze.

### Slice 1 — Vertical slice (the critical milestone)
**Build:** A 90–180 second curated traversal containing corridor -> threshold -> large hall -> loop. DRIFT path, manual grid control, one phrase-level reveal, two responsive material effects, and fallback UI.
**Exit:** It already feels compelling without the visitor touching anything, and the scene demonstrably follows the track rather than a fixed animation.

### Slice 2 — Authoring and musical direction
**Build:** Modular room kit; world graph; hand-tagged cue file and offline feature pipeline; central ExperienceDirector; 3–5 visual zones; deterministic seeking and transitions.
**Exit:** New mixes can be added by supplying audio metadata, cues, and tuning parameters rather than changing Babylon source.

### Slice 3 — Finish & integration
**Build:** Carefully tuned lighting/textures, UI typography, mobile controls, reduced-motion mode, WebGL fallback, QA, mix metadata, analytics/telemetry with privacy review, memory cleanup, and integration with the current ROOM frontend.
**Exit:** A complete permitted mix plays without drift, major frame spikes, accidental flashing, or losing controls; static content works without WebGL.

### Suggested agent separation
- **Lead/integration:** owns contracts, room journey, visual acceptance, branch integration.
- **Audio engineer:** playback, feature extraction, normalization, cues, testing fixtures.
- **World/engine engineer:** Babylon scene, modular kit, grid, camera, performance.
- **Experience/design engineer:** art direction, director transitions, UI, accessibility.
- **QA/performance:** browser/device tests, seek and pause reliability, CORS and reduced-motion checks.

Agents should begin against agreed TypeScript contracts and a shared deterministic test mix. Avoid parallel work directly editing the same scene file.

## 8. Acceptance tests

**Music/visual fidelity**
- Distinct passages (quiet section, steady groove, transition/drop) visibly but subtly produce distinct atmosphere in the same authored world.
- No dramatic macro transitions solely from a single kick or volume spike.
- Audio stays in sync after play, pause, seek, replay, tab switch, and device rotation.
- Analyzer reports non-zero data on the deployed audio origin; controlled silent fixture returns near-zero.

**Exploration**
- Hands-off DRIFT traverses at least a three-room sequence and loops indefinitely without collision.
- Manual input interrupts smoothly; no forcibly stolen control; STILL mode works.
- No mandatory game objective; all content is reachable through passive traversal.

**Quality/accessibility**
- Play is always user initiated; volume and pause are accessible.
- No rapid full-screen flashes; reduced-motion mode does not move the camera automatically.
- Works on desktop and mobile at tuned resolution; graceful fallback if WebGL is disabled.
- A complete mix has no audio interruption or accumulating GPU/CPU memory leak.

## 9. Decisions to lock before asset production

1. **One hero DJ mix:** Choose a legally usable reference mix spanning a breakdown/build/drop; use the exact file during tuning.
2. **One visual canon:** Review the actual Are.na block images, then select 8–12 references into an annotated moodboard (texture, palette, camera, architecture, UI).
3. **One initial chapter:** Corridor -> transmitter/altar -> great hall, not an infinite procedural dungeon.
4. **Rendering baseline:** Stay on Babylon.js if current ROOM engine integration is healthy; do not rewrite to Three.js for aesthetic reasons alone.
5. **Audio source policy:** First-party/CORS-enabled file first; live DJ feeds later.

## 10. Agent kickoff prompt

> Implement Slice 0 and Slice 1 of `ROOM — THE UNDERLEVEL` from this specification. Do not build a conventional RPG. Prioritize a convincing 90–180-second passive-first audiovisual vertical slice using Babylon.js, React, and TypeScript. Reuse the existing ROOM architecture where viable. First inspect the repository and write a short implementation plan and module boundaries. Create a single canonical audio playback path with AnalyserNode; show a debug overlay for normalized bands and audio time. Build a small connected authored dungeon, low-resolution material style, a no-collision DRIFT path, optional grid-based EXPLORE controls, and a large chamber reveal controlled by an authored musical cue. Add reduced-motion behavior, WebGL fallback, and tests for play/pause/seek. Do not add combat, inventory, procedural infinite generation, multiplayer, VR, or a huge asset set. Do not invent Are.na reference details not present in the assets; use temporary placeholders until exact board images are reviewed. Deliver screenshots, performance metrics, recorded behavior notes, and a list of next artistic decisions.

---

### Sources for technical decisions
- Babylon.js Audio V2 & analyzer: https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic
- MDN Web Audio API & media element: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- W3C CORS requirement for media audio source analysis: https://www.w3.org/TR/webaudio/
- MDN audio unlock best practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- W3C WCAG flashing guidance: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
