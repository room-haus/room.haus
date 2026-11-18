# Odd Ensemble — local Labs prototype

**Launcher:** Labs → Interactives → **Open Odd Ensemble ↗**.
**Built local preview:** http://127.0.0.1:4196/labs/#interactives.
**Development preview:** http://127.0.0.1:4195/labs/#interactives (HMR and live reload disabled).
**Status:** implemented and locally verified, including the completed thirty-minute live soak and ten reopen cycles. Desktop hardware performance and physical-phone qualification remain open. The original verification was local; see [combined PR integration](../superpowers/plans/2026-11-18-listening-prototypes-pr.md) for the later commit/PR scope. No deployment or public-season assignment.

## What is implemented
Three original hollow forms on fixed footprints: Low is broad, chalk-coloured and slow; Knuckle is tall cobalt with deliberate posture; Pip is smaller, olive and quicker. Authored ring meshes have asymmetric profiles, feet and restrained seam/gaze cues. Their three bounded springs control stretch (.75–1.35), lean (±15°), and aperture (0–1). Quiet breathing, sparse seeded attention gestures and one-hop neighbour responses continue without interaction. A neighbour answers the character actually addressing it.

Drag to stretch/compress and lean; stationary tap or Space pokes. Movement of 8 CSS pixels takes precedence over a tap; cancellation never pokes. Visible member buttons and Lean left/right, Stretch, Compress and Poke share the host action surface. Keyboard arrows use normalized .1 increments. A held member cannot be reclaimed by timeout or a second member selection. Release retains the current position/velocity and elastically returns to its musical pose. Keyboard/button control uses the host eight-second timeout and 1.5-second Watch blend; Keep control prevents timeout. Poke always supplies local feedback, while social propagation shares a 500ms cooldown.

The existing shared ListeningToy, ToyRuntime, ListeningSession, audio extraction and generalized registry remain the only host/lifecycle/playback system. MX029 by Saad Ashraf is the only sound. There are no oscillators, microphone input, samples, playback effects or transport calls in the simulation/renderer. Live features only influence visuals; ambient retains passive movement with neutral spectral data. Inactive playback and Pause motion freeze physics. Reduced motion opens still, with explicit Gentle motion; transient pokes are normalized to damped nudges even immediately after Reset. Rendering failure retains the shared transport and displays the original vector poster.

Underlevel, Endless Rally and all six geometry studies are preserved. Concurrent user follow-ups moved Hanging Balance and Endless Rally to Interactives; this task preserves those changes. Odd Ensemble now joins them under Interactives without new public routes or deep links.

## Design and interfaces
The approved technical design remains the authority: ../superpowers/specs/2026-11-18-listening-toys/odd-ensemble-tdd.md. ROOM's existing Neue Haas/mono hierarchy, chalk background and cobalt accent are retained under the app-design-principles foundation. The Choir reference informs direct tactile response and social timing only; all geometry and poster artwork are original. Provenance is in ../../src/experiences/odd-ensemble/assets/README.md.

The additive shared contract changes are documented in ../superpowers/plans/2026-11-18-odd-ensemble-shared-handoff.md: optional targetButtons, directionLabels, sceneCommand, simulation.suspend, and Gentle poke normalization. Existing consumers keep their default controls. No audio controller/session interface changed in this task.

## Evidence ledger
- New mechanics tests first failed with the missing simulation. Eight initial mechanics tests passed after implementation and the suspension hook.
- Independent read-only review found four input/transition defects plus incoherent neighbour selection. Each was reproduced by a failing regression before correction. The corrected focused runtime/concept suite passed 19/19.
- Full repository Node suite passed 105/105; both experience/Underlevel typechecks, lint and dependency audit passed (zero vulnerabilities). Existing Node module-type/npm-config warnings remain.
- Initial dedicated browser matrix passed 15/15 on Chromium, Pixel 7 Chromium emulation and iPhone 13 WebKit emulation. It covers keyboard/visible controls, tap/drag/cancel, second pointer handling, one unchanged media source, freeze with advancing mix, seek/reset, close/focus return, reduced/Gentle, renderer failure/retry, original poster, 390/768/1440 and 200% text. Final matrix additionally exercises native simultaneous CDP touches held for ten seconds and native 200% control taps.
- Live captures (not fixture audio): artifacts/odd-ensemble/live-captures.json records MX029 from https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/MX029.m3u8, playing with rate1/volume1; desktop/Android report live and native WebKit ambient. No page errors in those captures. These are browser playback/analysis observations, not independent acoustic monitoring.
- Renderer observations: 16 meshes, 16 draw calls, 21,818 triangles. No realtime shadow maps or postprocessing; DPR capped at1.5 desktop/1 coarse pointer. Final lazy concept bundle: 12,360 bytes JS (5,093 gzip), 7,759 bytes CSS including shared host styles (2,023 gzip), 1,815 bytes original SVG (891 gzip), measured with Python gzip. Timing evidence follows below.
- The first live soak was stopped after review corrections; pre-review-soak.json is retained solely as pre-fix evidence. The corrected thirty-minute run completed; results and scope are below.

## Limitations and decisions
This is a local prototype. No physical mid-range phone, full-length mix, production deployment or user art approval has been validated. Browser emulation is not physical-device performance. Initial visuals and gesture personality remain subject to user review. No feature claims exact beat sync, stem recognition or musical intent.

Independent review deferred a minor battery/performance improvement: the renderer recalculates normals for unchanged/frozen poses. It is bounded and allocates no new scene objects; actual timing is reported separately. Live soak/browser validation overlaps other local prototype validation, so contended timing must be labelled accordingly.

Rulings: work stays in the existing dirty feature checkout to reuse the actual local foundation; approved concept/TDD means no new design approval gate. Gentle Poke normalization belongs in the existing action adapter so reset cannot temporarily bypass the current motion preference. The attention/responder mismatch was treated as important because social legibility is central to the experience.

The 200% desktop capture exposed clipped member names despite no page-level overflow. An added browser test failed on `scrollWidth > clientWidth` for Knuckle; intrinsic-width wrapping fixed it (green). Camera framing now leaves room for the authored rim at maximum stretch. Captures are refreshed after these presentation corrections. Browser cases live in e2e/odd-ensemble.spec.cjs instead of the concurrently owned listening-toys.spec.cjs; the full repository command discovers both.

Final coordinated production rebuild passed (`npm run build`, webpack plus89 static pages). This task independently checked the served build:99 routes and94 assets passed against port4196. The pre-delta full repository browser snapshot passed223 with8 platform skips and0 failures; its retained log is artifacts/odd-ensemble/repository-browser-before-final-delta.log. That snapshot predates the final Gentle/release/cooldown/text fixes; the final shared+Odd matrix is recorded separately.

Final built-source shared+Odd browser matrix: **57 passed /3 platform skips /0 failed**, across all three configured projects. This includes23 Odd passes (24 cases with one CDP-only WebKit skip) and shared host regressions. The final-source output is retained in artifacts/odd-ensemble/final-shared-browser.log. Independent lazy-request inspection passed: neither entrance nor Labs requested a toy chunk; opening Odd requested only its JS/CSS, not Hanging Balance or Endless Rally. Final concept sizes are listed above; bundle-budget.json records the exact final filenames and byte counts.

Latest final CSS delta: a stale canvas image could show through the poster margins after simulated context loss. The reproduced failure was corrected with an Odd-only rule hiding the canvas in non-ready states. Final production rebuild passed. The complete Odd matrix then passed **23 /1 CDP-only WebKit skip /0 failures**; final keyboard ArrowUp/ArrowDown/Space checks also passed3/3 before that matrix. Refreshed fallback captures independently confirm `visibility:hidden`, advancing original-CDN playback and exactly one media element in desktop/Android/WebKit; source modes live/live/ambient. Final route/assets and lint checks passed again. The final bundle includes the concurrent Hanging Balance move to Interactives.

Five-minute built/live observation is in artifacts/odd-ensemble/five-minute-observation.json with minute-by-minute stills and the silent passive-and-poke.webm. It ran310 wall seconds without interaction, recorded12 autonomous gestures /12 neighbour responses, then accepted a deliberate poke. Timing was contended/software-rendered, so this is behaviour/visual evidence, not hardware performance qualification. Author inspection of the five-minute and response stills shows recognisable unequal silhouettes and selective lean/gaze; user feedback on personality/art remains outstanding.

The thirty-minute soak uses identical simulation and shared runtime source to the final build. Its source snapshot differs only by the later failure-only canvas CSS and concurrent Hanging Balance and Endless Rally category assignments; candidate-source.json and final-source.json record these exact deltas. Neither changes the healthy running ensemble path.

Final fallback images were visually inspected after the CSS correction: the original poster fills the stage without stale mesh fragments in its margins. Final lint and tracked whitespace checks pass. Source recheck found no simulation, renderer, input, runtime or audio drift; removing the two concurrent category fields reproduces the soak-start registry hash exactly.

## Completed endurance and timing evidence

The final original-CDN run completed **1,800.011 wall seconds**, with61 sampled states and0 page errors. It retained one playing media element, one running AudioContext,16 meshes,16 draw calls,21,818 triangles and37 tracked window/document listeners throughout. All sampled stretch/lean values were finite and bounded; pending reactions never exceeded1. Simulation time, media time and gesture/onset counters advanced monotonically without recovery resets. Final counters:83 autonomous gestures,83 neighbour responses,415 onset nods. The independent assertions are in artifacts/odd-ensemble/soak-verification.json; raw observations are in soak.json.

Closing paused the media, removed its src and closed its AudioContext. All **ten subsequent playing reopen/close cycles** ended with0 active media,0 active contexts and20 tracked global listeners. The pre-lazy-load baseline was7 listeners: thirteen remained after first initialization and did not grow across cycles. This instrumentation establishes no accumulating global-listener count across reopen cycles; it does not identify the owners of those retained initialization listeners or prove their absence.

This was a development/HMR-disabled live run on Apple M1 Max, concurrent with other local browser/build validation. The shared fixed-step stall cap intentionally dropped excess wall time:1,327.23 simulation seconds elapsed during1,800.01 wall seconds. Long-soak p95 was116.6ms under that contention; this is an endurance result, not a smoothness qualification. The final production source has the same simulation, renderer, host and audio code; only failure-state canvas CSS and concurrent category assignments differ from the initial snapshot.

Separate settled **60-second production-build** timing samples used Chromium's **SwiftShader software renderer**, not the M1 GPU. Desktop1440×1000 (effective render DPR1.5): p50=33.3ms, **p95=50ms**, above the20ms desktop target. Pixel7 emulation (render DPR1): p50=16.7ms, **p95=33.4ms**; this is not evidence for the34ms physical-phone target. Both remained at16 meshes/16 calls/21,818 triangles and live source mode. Exact backend, pixel dimensions, sample counts and diagnostics are in frame-timing.json. A headful attempt closed before producing a timing result and is not counted. The software-only miss is recorded rather than treating the machine's CPU model as GPU qualification; physical-device/GPU profiling and any resulting pixel/decorative-budget tuning remain required before promotion.

## Review artifacts

- Passive and interactive stage images: artifacts/odd-ensemble/desktop-passive-stage.png and desktop-interactive-stage.png.
- Android/WebKit passive, interactive, maximum stretch,200% text, reduced-motion and fallback captures are in the same directory.
- Five-minute silent recording: artifacts/odd-ensemble/passive-and-poke.webm.
- Reproducible capture/soak/timing runners: scripts/odd-ensemble-{capture,evidence,observe,fallback-capture,performance}.cjs.
- Optional shared interfaces: docs/superpowers/plans/2026-11-18-odd-ensemble-shared-handoff.md.

All paths above are relative to the repository root. The local preview remains running on4196. No deployment, push, PR, commit or public-season integration was performed.

Local category follow-up: user moved Odd Ensemble to Interactives alongside Hanging Balance and Endless Rally. Only its registry category, launcher entry URLs, and existing category expectations changed; the simulation/host/audio are unchanged. Historical soak source manifests describe their original snapshots.

Category follow-up verification: local production build and lint passed; existing category grouping and Odd launcher/control browser checks passed6/6 across desktop Chromium, Android emulation and mobile WebKit. Updated preview: http://127.0.0.1:4196/labs/#interactives.
