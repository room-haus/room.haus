# Odd Ensemble — technical design document

**Status:** Draft prototype design · **Date:** 18 November 2026\
**Labs category:** Experiences · **Proposed ID:** `odd-ensemble`\
**Depends on:** [Shared listening-toy contract](README.md)

## 1. Intent

A small assembly of rubbery, vaguely sentient objects listens to the same DJ mix as the visitor. They lean toward one another, compress, hesitate, and occasionally react as though one of them has broken an unspoken rule. Visitors can stretch or nudge one member and watch the group respond. Left alone, it remains an evolving ensemble for the duration of the mix.

The DJ recording stays untouched. These objects do not generate voices, mimic lyrics, or claim to detect individual instruments. Their performance is an interpretation of broad audio features.

## 2. Reference and original direction

- [Choir by David Li / Adult Swim](https://www.adultswim.com/etcetera/choir): elastic mouths form a playable choir; the opening scene and “pull open to sing” instruction loaded during research.
- [David Li's project index](https://david.li/) identifies the creator and project. [YourClassical's description](https://www.yourclassical.org/story/2020/07/30/adult-swim-choir) documents dragging lips to change pitch and chords. Full sound/gesture behaviour was not independently verified in this session.
- Adapt the immediacy of pulling something soft and seeing companions respond. Do not copy the mouths, facial arrangement, voice recordings or branding.

**Proposed ROOM art:** three unequal hollow vessels with seams or apertures, asymmetrical feet and understated gaze cues. A chalk-white ground, ink shadows and one cobalt member provide continuity with ROOM. The oddness comes from bodily timing and uneven proportions, not surface noise or flashing effects. Keep the fixed camera close enough to read a compressed silhouette on a phone.

## 3. Prototype boundary

**Minimum slice:** three independently deformable characters, one fixed camera, one original poster, three passive gestures, group-reaction propagation, pointer and keyboard manipulation, shared playback controls and fallback.

Exclude speech, facial capture, anatomical simulation, skeletal rigs, generative dialogue, a character editor, endless spawning and a second soundtrack. One mesh topology may support the three silhouettes through fixed authored parameters; each still needs a recognizable profile.

### Approaches considered

| Approach | Tradeoff |
| --- | --- |
| Full soft-body physics | Rich deformation, but expensive collision and stability work before the gesture is proven. Deferred. |
| Authored mesh deformation driven by damped spring channels | **Selected proposal.** Predictable silhouettes, low cost, testable limits; less physically literal. |
| Frame/sprite animation | Cheap to render, but weaker continuous dragging and depth. Useful only as a future low-power fallback. |

## 4. Behaviour and interaction

### Watch

Characters remain on assigned footprints; they never wander off-screen. Each has three spring channels: stretch, lean and aperture. They share a slow attention schedule but have different phase offsets and response strengths.

- Quiet/low intensity: small 6–10 second breathing cycles, long pauses, occasional glances.
- Sustained energy: stronger but bounded compression and coordinated lean; never every character jumping on every onset.
- Every 12–20 seconds of active simulation, a seeded choice gives one member a brief gesture: lean toward a neighbour, compress as if listening, or hold an awkward pose. A neighbour responds after 0.2–0.6 seconds, then the group settles.
- Autonomous group reactions have a minimum 8-second cooldown. They cannot schedule another group reaction, preventing feedback loops. No pause in the mix is treated as a failure.

### Control

Grab the body of any character. Horizontal movement controls lean; vertical movement stretches/compresses it. Deformation limits are relative to the rest shape: stretch scale 0.75–1.35, lean ±15°, aperture 0–1. Dragging applies a spring target, never direct unbounded vertex displacement. Release preserves current deformation/velocity and damps toward its current musical pose.

A deliberate poke produces one local compression and at most one neighbour response. Repeated pokes share a 500 ms group-response cooldown. No gesture changes audio. Host Watch/Keep control and the eight-second return rule apply; takeover only suppresses the selected character's autonomous pose driver.

**Keyboard/touch equivalents:** three visible target buttons identify members. With the interaction surface focused, Left/Right nudge lean and Up/Down adjust stretch in 0.1 normalized increments; Space performs Poke. Supply on-screen Lean left/right, Stretch, Compress and Poke buttons for the selected member. A stationary touch is a poke; a drag takes precedence after 8 CSS px of movement. Pointer cancellation releases safely without triggering a poke. All controls act on the same simulation actions.

## 5. Musical mappings

All parameters below are initial visual tuning proposals. Multiply automatic amplitudes by the shared motion amount; disable transient impulses in Gentle motion.

| Feature | Visible response | Limit |
| --- | --- | --- |
| Bass, smoothed | Compression of the grounded member | Up to 6% of rest height; counter-scale width modestly. |
| Mid | Aperture/torso articulation of the middle member | At most 20% added aperture; no lyric or singing claim. |
| High | Small rim/detail tremor on the light member | Up to 1% of character height. |
| Intensity | Strength of passive posture and group attention | Ease over at least 2 seconds. |
| Fresh onset | A single selected member gives a small nod | 400 ms local cooldown; never all three. |
| Brightness | Slow material warmth shift | Blend over at least 3 seconds, no hard palette cut. |

Do not depend on tempo estimation for the first slice. When analysis is unavailable but music plays, use the seeded breathing/attention schedule with no band-driven accents and show Ambient motion status. Inactive playback freezes the ensemble as required by the shared contract.

## 6. State and implementation

Create `src/experiences/odd-ensemble/`:

| File | Responsibility |
| --- | --- |
| `index.tsx` | Labs entry wrapping the shared host. |
| `config.ts` | Three IDs, rest shapes, feature weights, camera and bounded tuning. |
| `EnsembleSimulation.ts` | Pure fixed-step spring integration and reaction scheduling. |
| `mapAudio.ts` | Read-only features to bounded targets/one-shot impulses. |
| `BabylonEnsemble.ts` | Mesh deformation, lighting, picking and disposal. |
| `assets/` | Original poster and any authored textures with provenance. |

`EnsembleState` contains three records with `id`, stretch/lean/aperture position and velocity, attention target, and reaction hold time; plus selected/grabbed IDs, seeded random state and next autonomous gesture time. Renderer-only mesh references never enter the simulation. Use semi-implicit spring integration at the shared fixed step, clamp channels after integration, and damp outward velocity at a limit. Starting proposal: spring frequency 2 Hz with damping ratio 0.8; tune the feel without changing the documented bounds.

Deform a low-poly authored vessel along its local vertical axis; retain stable base vertices so it looks grounded. Approximate ellipsoid hit volumes are sufficient; no character-to-character collision solver is needed. At most one character is grabbed. Only the renderer deforms vertices; simulation emits numeric channels. Avoid per-frame mesh creation or shader compilation.

Seeded reset restores rest shapes and selects the passive schedule phase from the requested media time. User deformations are discarded on explicit reset/seek, not on a routine Watch transition. Host motion freeze retains channels and velocities; resume clamps the timestep and starts fresh audio analysis without replaying reactions.

## 7. Milestones and acceptance

1. **Tactile slice:** three distinct shapes; grab/release/nudge/poke; finite bounded springs at different render rates; original still composition.
2. **Ensemble slice:** autonomous attention schedule and one-hop neighbour reactions; no interaction required over ten minutes of synthetic time.
3. **Listening slice:** live feature mappings, ambient fallback, frozen pause/seek handling and host integration.
4. **Labs candidate:** visible launcher, complete controls, captured desktop/mobile states, shared regression/performance gates and 30-minute passive soak.

Create `test/odd-ensemble.test.mjs` to verify:

- Extreme/out-of-range actions never exceed stretch/lean/aperture bounds or produce non-finite state.
- Identical seed, fixed steps, feature sequence and actions produce identical states; 30/60 Hz rendering feeds the same fixed-step result.
- A held grab cannot be reclaimed by Watch timeout. Release blends without a position snap.
- One onset sample used by multiple physics steps produces one nod; repeated pokes cannot cascade endlessly.
- Paused motion holds the exact state; unavailable analysis retains passive scheduling without fabricated band activity.
- Seek/reset clears queued neighbour reactions and safely releases the selected object.

Extend `e2e/listening-toys.spec.cjs`: open this specific launcher; start the mix; use pointer, touch and keyboard controls; verify no seeks/volume/rate changes or extra audio sources; pause motion while audio advances; close during playback and confirm silence/cleanup and focus return. Include fresh-load reduced motion, renderer failure with continuing audio, and native-WebKit ambient mode.

**Qualitative acceptance:** a reviewer can identify the disturbed member and its neighbour's response in a short silent capture; after five minutes hands-off, the scene still reads as an ensemble rather than three identical meters. Record this as design feedback, not an automated test result. Final art requires user review before public promotion.

## 8. Risks and later integration

The main risk is a generic blob visualizer. Counter it with distinct silhouettes, asymmetric timing and selective reactions. Another risk is restless motion over long mixes; keep group events sparse and a genuine motion-pause control. Mobile deformation cost is bounded by mesh size, not a soft-body solver.

The simulation and renderer accept shared frames and contain no audio ownership. Later integration can attach the same visual runtime to a record player's source through the future borrowed-source adapter. No Underlevel cue or public season mapping belongs here.
