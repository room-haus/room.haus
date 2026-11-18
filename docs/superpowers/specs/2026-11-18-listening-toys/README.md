# ROOM Labs — interactive listening toys

**Technical design package · 18 November 2026 · Draft for prototype implementation**

These documents specify three separate Labs prototypes. They do not describe shipped functionality, approve a production season assignment, or change the current application. Here, TDD means **technical design document**.

| Prototype | Reference mechanism | Distinctive question | TDD |
| --- | --- | --- | --- |
| Odd Ensemble | Choir: elastic characters and social reactions | Can a small cast feel alive while accompanying a mix? | [Odd Ensemble](odd-ensemble-tdd.md) |
| Hanging Balance | Levers: a precarious mobile of unexpected objects | Can a physical arrangement remain fascinating both untouched and manipulated? | [Hanging Balance](hanging-balance-tdd.md) |
| Endless Rally | Konterball: a legible, compact ball-and-paddle game | Can an automated rally be enjoyable to watch and easy to join? | [Endless Rally](endless-rally-tdd.md) |

Working names, numeric tuning values, and the technical approach below are design proposals. The user selected all three concepts for prototype design, with DJ mixes as the primary listening experience and optional interaction. No prototype has been selected as a winner.

## 1. Product contract

- The DJ recording is the only audible output in the first prototypes. No singing, collision samples, synth notes, filter effects, ducking, pitch changes, or game sounds are added. Musicality comes from behaviour and visual timing.
- Each scene is interesting without input for a whole mix; visitors can briefly interfere and leave it running again. No compulsory tutorials, scores, lives, timers, wins, losses, or progression gates.
- Every interaction leaves playback time, playback rate, volume, and stream selection unchanged. Only labelled transport controls can change playback.
- Preserve ROOM's existing Labs navigation and typography. Each scene can have its own materials and personality; it must not inherit The Underlevel's dungeon visual system.
- Build original artwork and forms. References supply interaction mechanisms, not assets or characters to copy.
- First delivery is three local Labs experiments. Public record-page integration, season reassignment, sharing interaction recordings, multiplayer, and generated music are later decisions.

## 2. Verified source baseline

Inspected in the local `codex/underlevel-slice` working directory on 18 November 2026. This checkout contains substantial uncommitted work; the paths below describe that local state, not remote master or a deployed release. Recheck the baseline before implementation and preserve that work.

| Current source | What exists / implication |
| --- | --- |
| `src/labs/studies.js` | Six studies, four categories, and hash parsing. Only `3d-animations` currently resolves a study ID. |
| `src/labs/index.js` | Category counts and The Underlevel launcher are hard-coded; modal state is a boolean. |
| `src/labs/ExperienceModal.js` | A native dialog with focus return, scroll lock, Suspense, and an error boundary; it imports only The Underlevel. |
| `src/labs/scene.js` | Babylon-based geometry studies. Do not expand its switch into a game framework. |
| `src/experiences/underlevel/audio/` | Existing `AudioController`, `FeatureExtractor`, and `TempoEstimator`; useful audio logic is currently nested inside Underlevel. |
| `src/audio/HLSAudioSource.js` | Owns one media element and its stream. Native WebKit HLS deliberately bypasses Web Audio analysis to preserve audible playback. |
| `src/audio/usePlayer.js` | Public record player owns its source and single `notify` callback. A later visual adapter must not replace that callback. |
| `src/content/media.mjs` | Resolves catalog paths and configured media origins. Use it; do not hard-code CDN URLs. |
| `webpack.config.js`, `tsconfig.underlevel.json` | TypeScript transpilation and checking currently cover only Underlevel. New TS directories need explicit inclusion. |
| `test/`, `e2e/`, `.github/workflows/room-check.yml` | Node tests; Chromium, Android-emulated Chromium, and mobile WebKit browser projects; current CI gates described below. |

The existing analysis supplies five spectral bands, RMS, brightness, intensity, onset and estimated tempo. Tempo is confidence-gated, can be half/double-time, and is not an onset-aligned beat grid. No concept may promise exact beat sync, mood recognition, stem isolation, or automatic drop detection.

## 3. Shared technical decisions

### Alternatives considered

1. **Three self-contained applications:** quick individual spikes, but duplicates playback, lifecycle, accessibility, and failure handling. Rejected for the planned Labs prototypes.
2. **One thin host plus three independent simulations:** shared transport and lifecycle, independently replaceable scenes. **Recommended design in this package.**
3. **A general game engine or new physics framework:** greater scope and dependencies before proving the interaction. Deferred. Use the existing React/Babylon stack and small bounded simulations first.

Use TypeScript for the new simulation/runtime modules, React for controls, and the repository's existing Babylon version for rendering. DOM controls sit outside the canvas. No framework migration or dependency upgrade is required by these TDDs. Keep the simulations independent of React, Babylon, browser audio, and the catalog so synthetic inputs can exercise them directly.

### Proposed module boundaries

All paths in this section are **proposed**, unless listed in the baseline above.

| Path | Responsibility |
| --- | --- |
| `src/labs/experiences.js` | Explicit registry with `id`, `title`, description, poster, and a static lazy import for each experience. Includes Underlevel. |
| `src/experiences/shared/contracts.ts` | Audio feature, host-frame, action, simulation and renderer types. |
| `src/experiences/shared/ListeningToy.tsx` | Entry, transport, scene controls, status, static fallback and lifecycle for the three toys. |
| `src/experiences/shared/ListeningSession.ts` | Owns the Labs audio controller; snapshots playback and samples features for the host. |
| `src/experiences/shared/FixedStepClock.ts` | Bounded timestep accumulator, suspension and resume handling. |
| `src/experiences/shared/InteractionDirector.ts` | Watch/control return rules, independent of each toy's physical state. |
| `src/experiences/shared/listening-toy.css` | Scoped host styling; no global selectors that restyle Labs or Underlevel. |
| `src/experiences/shared/audio/{AudioController,FeatureExtractor,TempoEstimator}.ts` | One shared implementation promoted from Underlevel, with compatibility re-exports at its old paths. |
| `src/experiences/{odd-ensemble,hanging-balance,endless-rally}/` | Each toy's entry, configuration, simulation, audio mapping, renderer and original assets. |

Promote only generic audio types and modules; keep Underlevel's cues, director, enemies, narration and navigation local. Preserve its public imports through re-exports and its existing tests. The shared audio controller continues to own a source in Labs; do not add a second audio controller inside a toy.

Extend the TypeScript webpack rule to `src/experiences/`. Add `tsconfig.experiences.json` and `npm run typecheck:experiences` covering all experiences and their shared imports, and add the new check to CI. Keep `typecheck:underlevel` working until a separately reviewed consolidation. No new HTML entry or public route is needed.

### Proposed simulation interface

```ts
type ToyMode = 'watch' | 'control';
type AudioSourceMode = 'live' | 'ambient' | 'inactive';
type ResetReason = 'open' | 'user' | 'seek' | 'mix-change';
type ToyValueControl = 'counterweight' | 'paddle-position';
type ToyCommand = 'poke' | 'nudge-object' | 'settle' | 'nudge-ball';
type ToyAction =
  | {type: 'select'; targetId: string}
  | {type: 'grab'; targetId: string; x: number; y: number}
  | {type: 'move'; x: number; y: number}
  | {type: 'release'}
  | {type: 'nudge'; targetId: string; x: number; y: number}
  | {type: 'set-value'; control: ToyValueControl; value: number}
  | {type: 'command'; command: ToyCommand; targetId?: string};

interface ToyFrame {
  dt: number;                    // fixed step in seconds
  simTime: number;               // advances only while motion runs
  mediaTime: number;             // current DJ-mix position
  features: Readonly<AudioFrame>; // promoted existing AudioFrame type
  featureSequence: number;       // advances on a fresh 30 Hz analysis sample
  source: AudioSourceMode;
  mode: ToyMode;
  motion: number;                // 0..1
  reducedMotion: boolean;
}

interface ToySimulation<State> {
  reset(seed: number, mediaTime: number, reason: ResetReason): State;
  act(action: ToyAction): void;
  step(frame: ToyFrame): State;
  snapshot(): Readonly<State>;
}

interface ToyRenderer<State> {
  render(state: Readonly<State>): void;
  pick(clientX: number, clientY: number): string | null;
  resize(): void;
  dispose(): void;
}
```

`AudioFrame` is the generic existing feature shape, not the full Underlevel contract. Expose a monotonically increasing sample sequence from the shared controller; increment it only when a sample is actually extracted. Consume an onset only once per sequence, even if two physics steps use the same sample. Clear pending discrete events on pause, seek, buffering, or suspension. Keep sampled numeric values finite and bounded; invalid or unavailable input produces neutral features, never amplified motion.

Pointer coordinates in actions are normalized to the scene's interaction plane, `x,y` in `[-1,1]`; the host clamps them. Each simulation maps them into its own world units. Pointer capture ends on release, cancellation, blur, suspension or mode change. Ignore additional pointers while one is captured. Fixed cameras keep gestures unambiguous; no orbit gesture competes with object dragging.

`set-value` is an absolute normalized value in `[-1,1]`, not a simulated drag: counterweight maps linearly to 20–80% of its rail, and paddle-position maps to the near paddle's permitted x range. Each accepted value change enters Control and restarts the eight-second inactivity timer. Track a real pointer held on a DOM slider as active interaction until pointerup/cancel, without creating a grabbed scene object. Keyboard changes are atomic actions; selection/focus alone does not take control. Changing a slider while a scene object is grabbed first releases that grab.

Commands are explicit: Poke requires an ensemble member ID; Nudge object requires a mobile object ID; Settle and Nudge ball are scene-wide and carry no target ID. Unsupported commands/controls and unknown IDs are ignored. An accepted command enters Control and restarts the timer; Settle first releases a grab, preserves counterweight placement and suppresses autonomous forcing during its 1.5-second settling transition. Rejected cooldown actions do not reset the timer. Physical actions/commands/value changes are rejected while motion is frozen; selection remains available. No command implicitly calls transport. Pointer, keyboard and button adapters all use this same action surface.

### Audio, clock and lifecycle

1. Opening a launcher loads only that experience's bundle and poster. It does not start audio. **Play mix** creates/resumes the owned source from a user gesture. Start with catalog MX029 via `mediaUrl('mixes/MX029/MX029.m3u8')`; do not import Underlevel's chapter cues. The host accepts a mix descriptor so later mixes require no simulation edits.
2. Keep the existing audible path untouched. Analysis is read-only. Do not attach a second `MediaElementAudioSourceNode`, connect an analyser to audible output, or request a microphone.
3. `live`: playing and analysis available. `ambient`: playing but analysis unavailable; use gentle seeded autonomous behaviour, with **Ambient motion · live analysis unavailable** visible. `inactive`: idle, paused, ended, error, buffering or seeking; freeze autonomous simulation and clear impulses. Rendering and controls remain available.
4. Use fixed `1/60 s` simulation steps; cap accumulated elapsed time to `0.05 s` (at most three steps per frame), dropping excess time. Sample audio at 30 Hz; render at the display cadence. Repeated features must not duplicate transient events. A toy's schedule follows simulation time; a seek explicitly resets it. Do not derive physics time from a long playhead jump.
5. Freeze world motion while playback is inactive, when **Pause motion** is selected, or when the document is hidden. Pausing motion does not pause the mix. While frozen, allow target selection and transport; manipulation controls are disabled with **Resume motion to interact**. No automatic fast-forward on return to the tab. Preserve the paused pose and current playhead.
6. On seek, release grabbed objects, clear feature history and queued impulses, reset to a safe seeded pose parameterized by the new media time, and resume only if playback and motion were active. Do not replay skipped collisions or promise restoration of earlier user actions. **Reset scene** similarly resets the toy without seeking or restarting the recording.
7. Closing the Labs modal explicitly pauses the owned source, then disposes it, its HLS attachment, Web Audio graph, renderer, animation callbacks, observers and input listeners. `HLSAudioSource.releaseMedia()` currently does not explicitly call `media.pause()`; the shared owner must do so before disposal, and closure must be audibly verified. Async imports/results arriving after close are ignored. Reopening creates one fresh session at time zero and a fresh scene.
8. Hidden-tab playback may continue through the existing browser media behaviour, but visual updates stop. On visibility return, clear analysis history and the timestep accumulator, release input, and resume from the held physical state with fresh features. A seek that occurred while hidden still triggers the safe reset.

### Passive/control transitions

Default is **Watch**. A valid grab, nudge, command or value change enters Control with the scope defined above and in the concept TDD; autonomous behaviour for other objects continues unless the command explicitly suspends it. Eight seconds after the last interaction ends, blend the controlled object back into Watch over 1.5 seconds, preserving position and velocity. Never take over a held pointer. A **Keep control** toggle prevents timeout; **Watch** explicitly releases control. These are independent of mix play/pause. No input is required to recover from a toy's mishap.

Reduced-motion preference starts with motion paused, a composed still frame, and working audio controls. The visitor may explicitly start **Gentle motion**, which caps the motion setting at 0.2, disables automatic camera movement and transient impulses, and uses damped interactions without fling. A newly enabled system preference pauses motion again. Normal **Pause motion** always freezes physics; direct manipulation never secretly bypasses that choice.

## 4. Labs integration

- Register the three toys in **Experiences**, alongside The Underlevel. Keep `3D animations`, `Interactives`, and `Audio experiments` intact; do not duplicate launchers across categories.
- Replace the boolean modal state with `activeExperienceId: string | null`. Generalize `ExperienceModal` to receive the registry descriptor; the descriptor supplies title, loading copy and lazy component. Remount the error boundary by ID/attempt so one failed load does not poison another experiment.
- Registry entries supply `Component({onClose})`. Underlevel retains that interface; each toy entry wraps `ListeningToy` with its own config. Category counts derive from registry data.
- Keep the current `/labs#experiences` URL convention. Launchers open modals without changing history or auto-opening on reload. Per-toy deep links are deferred. Preserve legacy 3D study hashes and retained study settings.
- Retain native-dialog focus containment, Escape handling, inert background, scroll restoration, and return focus to the specific launcher. A loading or failed experience always has **Back to Labs**. Only one modal/session can exist at a time.
- Before opening any experience, pause the existing 3D study. Render-loop disposal already follows category unmount; verify no hidden study engine continues under a modal.
- Each launcher shows title, one-sentence premise, an original poster, **Prototype** status and **Open …**. Within a toy show artist/mix, transport, Watch/Keep control, Pause/Resume motion, Reset scene and Back to Labs. Advanced diagnostics stay collapsed and Labs-only.
- The existing client-side Labs gate and `noindex` remain. They are not security boundaries. Do not include private material or issue new public routes.

## 5. Accessibility, failure and resource budgets

Use the app-design-principles foundation at `/Users/pmarko.alt/.codex/skills/app-design-principles/SKILL.md`. Visible controls use the existing Labs type hierarchy, clear focus, at least 44 px touch targets and no horizontal overflow at 390, 768 and 1440 px viewport widths. Support 200% text zoom. Every drag has target-selection plus keyboard/button alternatives specified in its TDD. Do not steal arrow/Space keys from transport sliders or other focused controls. Avoid frame-rate screen-reader announcements.

Renderer failure or WebGL context loss switches to the poster and leaves the host-owned mix playing with transport and close controls. Scene retry recreates only the visual runtime. Audio failure shows the existing actionable playback error and Retry; the scene holds without pretending music is playing. A whole-component error exits to the modal boundary and cleans up the owned session. Poster failure shows title and controls against a solid background.

Initial per-prototype budgets: at most 50 draw calls, 100k visible triangles, device pixel ratio capped at 1.5 desktop / 1 mobile, no realtime shadow map or postprocessing in the first slice, and at most 1 MB compressed concept-specific JS plus 2 MB of concept-specific assets, excluding already shared Babylon/HLS/runtime chunks. Lazy loading must keep toy assets out of the entrance and archive's initial requests. Targets are proposals to measure, not established performance.

Aim for p95 frame interval at or below 20 ms desktop / 34 ms on a physical mid-range phone during a 60-second settled run. If below target, reduce pixel ratio and decorative meshes without changing the interaction rules. Report browser emulation separately from physical-device measurements. A 30-minute passive soak and ten open/close cycles must show stable object counts, finite simulation state, no accumulating listeners/contexts, and no overlapping playback. Full-length mix validation is required before production promotion.

## 6. Build order and acceptance gates

**Recommended order:** shared host and extraction → Hanging Balance → Odd Ensemble → Endless Rally. Each concept remains independently acceptable/rejectable. The shared work is done once, then each TDD's small slice can establish whether its interaction is worth polishing.

1. **Contract slice:** generalize the Labs launcher; extract generic audio with compatibility exports; implement clock/mode/failure ownership; add TS coverage. Existing Underlevel and Labs behaviour must remain intact.
2. **Mechanic slice:** implement one concept's minimum object set and pure simulation, synthetic-feature tests and keyboard/touch controls. No large asset library.
3. **Musical slice:** wire real mix features, quiet passages and unavailable-analysis fallback. Verify interaction never changes the audible recording.
4. **Labs candidate:** original art/poster, browser evidence, soak/resource checks, short side-by-side passive/interactive capture, and an honest list of limitations.
5. **Later integration:** evaluate the three candidates, select an experience and record/season mapping, then write a focused production integration plan. Prototype completion does not trigger this step automatically.

### Required verification when implemented

The current change is documentation-only; these are **future implementation gates**, not checks claimed to have passed.

| Scope | Commands / evidence |
| --- | --- |
| Focused mechanics | `node --test test/listening-toy-runtime.test.mjs test/<concept>.test.mjs` after those tests exist; assertions listed in each TDD. |
| Type/build/regression | `npm run typecheck:experiences` (new), `npm run typecheck:underlevel`, `npm run lint`, `npm test`, `npm run build`. |
| Focused browser | `npx playwright test e2e/labs.spec.cjs e2e/underlevel.spec.cjs e2e/listening-toys.spec.cjs`; add the new test file during implementation. Run across all three configured projects. |
| Release candidate | Current CI also runs `npm audit --audit-level=low`, `node scripts/check-routes.mjs` against the built HTTP preview, and `npm run test:browser`. Retain these gates. |
| Visual/audio evidence | Desktop, mobile, 200% text, keyboard-only, reduced motion, native-WebKit ambient mode, live-CDN audio, deliberate network/renderer failures, and close-while-playing. |
| Runtime evidence | Ten reopen cycles, 30-minute soak, frame timing and renderer/resource counts; record hardware and which media origin was used. |

Pipe shell validation output through `compress` with a focused question as required by the user's instructions; preserve the command's failure status (for example, use `set -o pipefail`). Test mechanics with synthetic feature sequences; separately verify actual audio and the original media origin. Cached/fixture success is not live playback evidence.

### Later public-player adapter

The production player already owns an `HLSAudioSource`. Future integration must provide features and playback snapshots to a toy without creating, disposing, pausing or replacing that source or its `notify` callback. The prototype simulation interface supports this; the borrowed-source adapter itself is outside this slice. Removing a public-page toy must leave the mix playing at its current position. Keep mix ownership and visual ownership separate before attempting that work.

## 7. Evidence and remaining decisions

Reference research was performed on 18 November 2026. See individual TDDs for URLs and access limits. Mechanic descriptions are reference observations/documentation; the musical mappings, art direction and passive modes in these TDDs are ROOM proposals.

No further product choice blocks the prototype designs. Builders may tune materials, spring constants, camera composition and bounded response curves within the explicit interaction and accessibility contracts. Final names, final character art, use of additional mixes, optional sound effects, and the chosen public experience remain open. Additional sounds require a separate explicit decision; they are not an implied part of these prototypes.
