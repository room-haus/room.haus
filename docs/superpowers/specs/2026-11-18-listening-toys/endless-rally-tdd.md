# Endless Rally — technical design document

**Status:** Draft prototype design · **Date:** 18 November 2026\
**Labs category:** Experiences · **Proposed ID:** `endless-rally`\
**Depends on:** [Shared listening-toy contract](README.md)

## 1. Intent

A single ball travels around an improbable little court. Two imperfect paddles keep it moving; a soft bumper occasionally seems to lean into its path. The scene is amusing to watch, and a visitor can take over one paddle for a few exchanges before returning to passive listening.

It is an ongoing rally, not a reflex challenge. Missing is part of the choreography. The recording continues unchanged; impacts never produce sound, change playback, or imply exact beat synchronization.

## 2. Reference and original direction

- [Konterball — wild / Google](https://wild.as/work/google-konterball) documents browser ping-pong, single/multiplayer play, commissioned music/sound design and an Awwwards Site of the Day award.
- On 18 November 2026 its case study was accessible, but embedded videos were unavailable in the inspected browser. [The project landing page](https://konterball.com/) states that it is being updated from WebVR to WebXR and offers a 360 experiment in the meantime. Current full gameplay was not verified.
- Adapt the compact, readable court and obvious ball/paddle interaction. ROOM's prototype is single-user, noncompetitive and visual-only in its response to the mix. No copied music, court assets or VR requirement.

**Proposed ROOM art:** a shallow 3D court with slightly skewed boundaries, chunky ceramic paddles, an ink ball with a cobalt seam, and one rubbery arch/bumper that looks almost cooperative. A fixed elevated camera makes the rules readable. Slight imperfections come from shapes and timing, not random camera movement. Keep the ball distinct from the background in every material state.

## 3. Scope and approaches

**Minimum slice:** one ball, two automated paddles, two reflecting side walls and two open goal ends, one fixed-position deforming bumper, one recovery path, one camera, one poster, and user takeover of the near paddle. No level editor or obstacle-placement interface in the first slice.

| Approach | Tradeoff |
| --- | --- |
| Full rigid-body 3D table tennis | Realism introduces depth judgement, tunnelling and input complexity; weak fit for casual listening. Deferred. |
| Planar arcade simulation with 3D presentation | **Selected proposal.** Readable controls, deterministic collisions and reliable autonomous play. |
| Pre-authored looping animation | Easy to watch, but takeover cannot meaningfully alter the rally. Rejected. |

Exclude multiplayer, VR, score/lives, increasing difficulty, achievements, speed penalties, leaderboards, multiple balls and sound effects. The bumper may squash visually but its collision shape stays fixed in the first slice.

## 4. Watch and takeover

### Watch

Two controllers target the predicted intercept of the ball at their own paddle plane. They have finite speed and acceleration, so they can miss. A seeded small target bias varies no more than once every 8–12 seconds; avoid frame-by-frame randomness. Both controllers anticipate the two side walls and the fixed bumper using a bounded collision prediction.

Each rally includes moments of uncomplicated travel. The bumper visibly compresses after contact, then recovers. Slow changes in lighting and paddle posture prevent an identical short loop. The ball does not multiply, accumulate speed forever, or demand input to escape a corner.

### Control

Pointer-down on the near paddle or its designated control strip takes over that paddle. Horizontal drag maps to its target x-position; acceleration/speed caps keep movement smooth. The far paddle remains automated. Release ends the held gesture but preserves manual targeting until the shared eight-second return, unless Keep control is enabled. Watch blends target authority back to the automated controller over 1.5 seconds without changing paddle position abruptly.

Keyboard Left/Right changes the near paddle target in 0.1 normalized increments. Provide visible left/right buttons and a labelled **Paddle position** slider. The slider dispatches `set-value` with `control: 'paddle-position'`, mapping `[-1,1]` to the near paddle's x range without synthesizing a grab. **Nudge ball** dispatches the scene-wide `command: 'nudge-ball'` and applies a small capped deflection with a two-second cooldown; it is a playful recovery gesture, not a score mechanic. Nudge is ignored during Returning and does not alter paddle ownership; its accepted action still restarts the Control inactivity timer. No cooldown announcement is needed each frame. User actions are unavailable while motion is paused, in line with the shared host.

### Miss and recovery

A ball exiting behind either paddle enters **Returning**. Over 1.2 seconds of simulation time it follows an authored off-court return path into a neutral serve position, then relaunches toward the opposite side. No fail screen, restart button, audio interruption or score appears. The same recovery triggers for a stalled ball (speed below 0.2 units/s for two seconds), out-of-bounds/non-finite state, or repeated trapped collisions. Recovery is quiet choreography; invalid-state recovery counts remain visible in Labs diagnostics and must be zero in normal acceptance runs.

## 5. Music-to-motion design

| Feature | Visible response | Guardrail |
| --- | --- | --- |
| Intensity | Target travel speed | 1.2–2.4 units/s, eased over 4 seconds; never accelerates without limit. |
| Bass | Bumper squash / paddle body compression | Up to 5% deformation, collision shapes unchanged. |
| Fresh onset | A small paddle posture accent | 500 ms global cooldown; no forced collision or ball teleport. |
| High | Ball seam or edge highlight | One local low-amplitude accent, no flash/strobe. |
| Brightness | Slow surface warmth | 4-second blend. |

Ball/paddle impacts create a brief visual squash driven by the actual collision event. Do not force impacts onto estimated beats, alter time to reach a beat, or claim that collisions form a musical sequencer. This is a playful court accompanying the mix. Ambient mode runs the autonomous rally at 1.5 units/s without claiming live response. Gentle motion runs a fixed slow speed of 0.6 units/s and suppresses onset accents and elastic overshoot; interactivity remains available after explicit opt-in.

## 6. Simulation and renderer

Create `src/experiences/endless-rally/` with `index.tsx`, `config.ts`, `RallySimulation.ts`, `mapAudio.ts`, `BabylonCourt.ts`, and `assets/`.

`RallyState` contains phase (`rally` or `returning`), ball position/velocity, two paddle positions/velocities/targets, control authority, seeded controller bias schedule, bumper compression, recovery-path phase, collision sequence/cooldowns and diagnostic recovery counts. Only one ball exists throughout.

Use a planar 4 × 6 unit court with transverse x and longitudinal z coordinates, ball radius 0.1, paddle half-width 0.55, paddle x range ±1.35, paddle speed ≤3 units/s and acceleration ≤12 units/s². The side walls are at x = ±2 (ball-center limits ±1.9); paddle faces are at z = ±2.6. Court ends at z = ±3 are open: a goal event occurs when the ball center reaches z = ±3.1, fully behind the end. Goal planes never reflect the ball. Start with a fixed circular bumper radius 0.3 placed off the centre serve lane. These are proposed tuning values; boundary/collision tests must be updated with any change.

Use swept circle collision against the two side walls, paddle faces and bumper, plus swept crossing tests for the two nonreflecting goal planes. For each fixed step, choose the earliest event. At solid contact, advance to it, reflect with a bounded paddle-position/velocity bias, and consume the remaining step time. At a goal crossing, enter Returning immediately and stop processing rally collisions for that step. For equal-time events within numerical tolerance, resolve a valid solid paddle/bumper contact first, then side-wall contact, and re-evaluate any goal crossing from the resolved position/velocity. A missed paddle must allow the ball to continue through the open end. Limit contact processing to four events per step; if exceeded, enter the authored recovery state instead of spinning in a collision loop. Separate resolved contacts with a small positional epsilon to avoid re-hitting the same surface at zero elapsed time.

Keep ball speed within the currently allowed range. At paddle hits, enforce a minimum longitudinal component of 35% of speed so the ball cannot become trapped in a nearly horizontal path. User paddle motion changes departure angle but cannot create unbounded energy. Prediction uses the same geometry/collision helper as simulation, capped to two seconds or eight predicted contacts; if no intercept is found, the automated paddle returns toward center. Prediction never mutates live state.

The autonomous controllers may miss; recovery guarantees continuation. During Returning, normal collision processing is disabled. Frozen motion holds recovery progress. Reset/seek resets both paddles, ball and driver phases to a safe seeded serve state and releases input without changing playback.

Rendering uses a shallow 3D stage, simple shadows baked into art or static planes, and squash channels derived from collision events. Collision geometry and decorative shape remain separate. No realtime physics plugin, dynamic mesh allocation on collision or per-frame React state updates are needed. Keep scene diagnostics outside the primary listening UI.

## 7. Milestones and acceptance

1. **Arcade slice:** deterministic ball motion, swept collisions, two automated paddles and reliable no-input recovery with synthetic frames.
2. **Takeover slice:** drag/keyboard/slider control, bounded paddle motion, timeout/Keep control/Watch transition and deliberately missed returns.
3. **Listening slice:** bounded speed/articulation mapping, live and ambient modes, pause/seek/Gentle motion, no extra audio.
4. **Labs candidate:** original court/poster, launcher, browser evidence, performance checks and 30-minute passive soak.

Create `test/endless-rally.test.mjs` covering:

- Maximum-speed ball cannot tunnel through a paddle/wall/bumper at the fixed step; corner and overlapping-contact fixtures terminate within the event cap.
- A trajectory outside paddle reach crosses the nonreflecting goal plane and enters Returning; a trajectory intercepted earlier by the paddle reflects and does not emit a goal event.
- Paddle hits change departure angle while preserving speed bounds and minimum longitudinal motion.
- Prediction leaves the live snapshot unchanged and has a fixed iteration budget.
- A miss and a deliberately stalled ball return to active rally within 1.2 seconds after recovery begins; music commands are absent from this path.
- Held input prevents autonomous takeover; Watch blends without snapping position; pointer cancellation releases control safely.
- Absolute slider actions set the near paddle target without capture state; a held slider pointer prevents timeout and every accepted keyboard value change restarts it.
- Synthetic 30-minute runs preserve one ball, finite state, bounded paddle/ball positions and zero invalid-state recoveries. Ordinary misses may recover repeatedly.
- Cached onsets cause only one accent; inactive playback holds exact state, including recovery phase; seek clears old impacts.
- A seed and fixed input sequence reproduce collision/recovery outcomes independently of render cadence.

Browser coverage in `e2e/listening-toys.spec.cjs` must deliberately miss with the manual paddle and observe a new rally, let Watch run untouched, operate the slider by keyboard, pause motion while the mix continues, close during Returning, test mobile hit areas and verify renderer/audio failure behaviour and no additional audible sources.

**Qualitative acceptance:** a new viewer understands which paddle is controllable within ten seconds from the single-line hint and control strip. A five-minute hands-off capture includes successful returns, at least one deliberate test of miss recovery, and no need to reset. The court remains readable without sound and feels related to the music when sound is restored; the latter is a listening review, not evidence of exact beat sync.

## 8. Risks and later integration

The main risk is demanding too much attention from a listening experience. Keep no score and make recovery ordinary. Constant speed changes can feel unfair; four-second easing and bounded ranges are mandatory. If 3D perspective obscures collisions, flatten the camera rather than adding targeting aids or a second movement axis.

The public-page version would consume the existing player's read-only features and keep this self-contained simulation. Standalone game routes, multiplayer and season rollout require later decisions after the three Labs concepts have been compared.
