# Hanging Balance — local prototype handoff

Implemented against the approved November 18 listening-toy technical designs in `docs/superpowers/specs/2026-11-18-listening-toys/`. This is a Labs prototype, not a production season assignment. This handoff records the original local implementation. See [combined PR integration](../superpowers/plans/2026-11-18-listening-prototypes-pr.md) for the publication scope and current candidate verification.

## Open it

The local built preview is running at **http://127.0.0.1:4194/labs/#interactives**. To restart it, use Node 24, `npm run build`, then `PORT=4194 npm run serve`. Use the existing Labs gate, select **Interactives → Open Hanging Balance → Play mix**. Launcher navigation remains `/labs/#interactives`; opening does not create a route or change history. Playback starts only from the labelled transport control. MX029 / Saad Ashraf resolves through `src/content/media.mjs` to the configured catalog origin.

Select one of the five objects or the counterweight. Drag an object, use canvas arrow keys or the directional buttons, move the counterweight slider, or use Nudge / Settle. Watch returns control automatically after eight seconds plus a 1.5-second blend. Keep control prevents that timeout. Pause motion freezes interaction without pausing the mix. Reduced motion starts still and requires explicit Gentle motion.

## Reuse these shared interfaces

| File | Responsibility / contract |
| --- | --- |
| `src/labs/experiences.js` | Static lazy registry. Each component accepts `{onClose}`. Count and launchers derive from entries. Optional `category` defaults to `experiences`; Hanging Balance uses `interactives`. Register only working experiences. |
| `src/labs/ExperienceModal.js` | Native dialog, loading/error boundary, scroll lock, Escape and launcher-specific focus restoration. |
| `src/experiences/shared/contracts.ts` | `ToyConfig<State>`, `ToySimulation<State>`, `ToyRenderer<State>`, `ToyAction`, `ToyFrame`. |
| `src/experiences/shared/ListeningToy.tsx` | Generic React transport, target/value/command controls, pointer capture, keyboard adapter, visibility and reduced-motion lifecycle, poster fallback and visual retry. |
| `src/experiences/shared/ToyRuntime.ts` | Shared accepted-action gate, frozen input rejection, release/reset ownership and simulation stepping. |
| `src/experiences/shared/ListeningSession.ts` | Exactly one owned Labs audio controller; sampled playback/features, seek notifications, ambient fallback and transient caching. Never use this owner for a borrowed public player. |
| `src/experiences/shared/FixedStepClock.ts` | 1/60-second steps, total accumulator capped at 0.05 seconds, no hidden/resume catch-up. |
| `src/experiences/shared/InteractionDirector.ts` | Watch/control, held-pointer and slider ownership, Keep control and smooth return. |
| `src/experiences/shared/audio/` | Single promoted AudioController, FeatureExtractor, TempoEstimator and audio contracts. Old Underlevel imports are compatibility exports. |

A simulation returns **true only when it accepts an action**; false does not extend inactivity. Selection alone does not claim control. Unknown commands, IDs and value controls must return false. The host clamps pointer actions to `[-1,1]`; a renderer's `point()` translates CSS client coordinates into that normalized interaction plane. Each concept maps to its own world units. `set-value` is an absolute value, not a drag. DOM sliders retain pointer ownership without grabbing a scene object.

`ToyFrame.autonomy` is 0 while the chosen target is controlled and blends to 1 over 1.5 seconds after eight seconds of inactivity. Mode becomes Watch when the blend completes. Other autonomous objects can continue. Do not implement a second return timer or reset physical state on return. Consume a transient at most once per `featureSequence`. The session retains a 30 Hz sample across render frames so a 120 Hz frame with zero physics steps cannot lose an onset.

Use actual callback execution time for session sampling. RAF timestamps may precede a blocked task. Cap **physics** elapsed time in the fixed clock, not media/analysis elapsed time: capping both falsely treats a render stall as a seek. Reset scene leaves the mix untouched; seek releases captures and reconstructs a safe seeded pose. A continuous hidden-tab playhead advance does not reset the scene.

A renderer creates no audio, owns no independent animation loop, and must dispose its engine. Its `metrics()` reports per-frame draw calls, not Babylon's cumulative counter when `scene.render()` is called manually. The stage canvas is absolutely positioned to keep engine backing-buffer sizes from feeding back into responsive grid layout. Retry scene recreates visuals only; the owned source stays alive.

## Hanging Balance mechanics and art

`config.ts` fixes topology, lengths, masses and limits. `MobileSimulation.ts` holds only numeric/plain state and computes descendant torque, damped pendulums, bounded compliant grabs, permanent attachments and capped object contacts. The counterweight changes top-rod equilibrium and stays where the user leaves it. Settle preserves the weight, releases input, clears initial velocities and suppresses autonomous forcing for 1.5 seconds. A last-finite-state guard is diagnostic, not evidence of success.

`mapAudio.ts` maps bounded bass/intensity/high/brightness/onset features into small visual forces. `BabylonMobile.ts` creates original low-poly bell, stone, bent-disc form, hollow vessel and little onlooker. No runtime shadows, postprocessing or generated audio. Camera framing and picking use the same orthographic interaction plane. `assets/poster.svg` is original artwork and doubles as the visual fallback.

The shared host uses ROOM's existing Neue Haas font stack and mono eyebrow, clear focus outlines, DOM controls, at least 44 px targets, and responsive layouts. No concept should import Underlevel cues or dungeon styling.

## Verification and evidence

See `validation.md` for the completed check ledger and evidence limits. Repeatable local evidence runners:

- `scripts/hanging-balance-evidence.cjs`: real-time passive soak against original CDN MX029; samples ownership, state and geometry, records frame intervals, then checks close cleanup. `BALANCE_SOAK_SECONDS` defaults to 1800; `ROOM_TEST_ORIGIN` chooses the local preview.
- `scripts/hanging-balance-captures.cjs`: real CDN desktop / Android-emulated / mobile-WebKit captures, opposite signed counterweight equilibrium, Android CDP touch dragging, 200% root text and disposal.
- `test/hanging-balance.test.mjs`, `test/listening-toy-runtime.test.mjs`, `test/listening-session.test.mjs`: deterministic mechanics, synthetic 30-minute maximum-input stress, clock/ownership/feature lifecycle.
- `e2e/listening-toys.spec.cjs`: fixture-based transport ownership, seek/reset/pause, pointer cancellation, reduced motion, visibility, renderer/audio failures, ten reopen cycles, context/listener cleanup, text reflow and blocked-frame regression.

Fixture WAV playback, injected visibility/context-loss events and browser device emulation are synthetic evidence. They are not physical-phone tests or human auditory verification. Live CDN playhead/analysis and media pause/context closure are recorded separately. No full-length mix or production qualification is claimed.

The simultaneous Endless Rally and Odd Ensemble tasks added their own implementations and registry entries in this shared checkout. This task preserves that work; it did not add an empty launcher for either remaining concept. Odd's opt-in target buttons, direction labels, tap/Space command and suspension hook are documented in `docs/superpowers/plans/2026-11-18-odd-ensemble-shared-handoff.md`.
