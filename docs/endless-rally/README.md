# Endless Rally local prototype

This ledger records the original prototype verification. See [combined PR integration](../superpowers/plans/2026-11-18-listening-prototypes-pr.md) for the later commit/PR scope and current candidate checks.

Open the local Labs preview at `http://127.0.0.1:4192/labs/#interactives`, then choose **Open Endless Rally**. Playback starts only with **Play mix**. The configured recording is Saad Ashraf’s MX029. Existing Labs access, other launchers and public routes remain intact. The launcher was moved from Experiences to Interactives at the user's request after prototype verification.

## Implementation

The prototype has one ball, two automated paddles, two reflecting side walls, two open goal ends and a fixed circular bumper with visual deformation. The planar simulation has a shallow Babylon presentation. Swept contact and prediction share `geometry.ts`; prediction copies the ball, has a two-second/eight-contact budget and never mutates live state. Each simulation step permits four events; crossing either goal plane enters Returning without reflecting.

Misses, stalls and trapped contacts use a continuous 1.2-second path around the outside of the court and back to a seeded serve. Invalid state has a separate diagnostic counter. Neither recovery nor interaction calls playback. Ball impacts only affect visual squash; no additional audio engine, nodes or sounds are created by Rally.

Drag the blue paddle or the labelled lower edge of the court. Keyboard Left/Right, visible buttons and the absolute Paddle position slider use the shared action contract. Keep control prevents timeout; Watch and inactivity return authority smoothly. Nudge ball does not take paddle ownership. Reduced motion starts paused; Gentle motion uses a fixed 0.6 units/s speed and suppresses elastic accents.

## Shared integration

The shared foundation was built in coordination with the concurrent Hanging Balance task, which owns `src/experiences/shared/` and the generalized Labs modal. This task reuses that single foundation; it does not supply a second host or audio controller.

- Generic audio lives under `shared/audio/`, with compatibility exports at the old Underlevel paths.
- `ListeningSession`, `FixedStepClock`, `InteractionDirector`, `ToyRuntime` and `ListeningToy` own audio, bounded time, input and lifecycle.
- `ToyFrame.autonomy` exposes the shared 1.5-second return blend; `act()` returns an acceptance boolean so rejected actions cannot restart inactivity.
- Renderers provide `point()` for normalized input and `metrics()` for Labs diagnostics. Configured labels, horizontal value keys and phase copy allow each toy to keep its identity.
- `src/labs/experiences.js` adds the lazy Endless Rally entry and poster. TypeScript/webpack/CI coverage includes all experiences, retaining the Underlevel check.
- Final host hardening includes real callback wall time for seek detection, parent-based canvas resizing, explicit second-pointer rejection, finite feature normalization, restored stage-status stacking, and root/body scroll-lock restoration for actual 200% mobile touch coordinates.

See [the shared foundation handoff](../superpowers/plans/2026-11-18-listening-foundation-handoff.md) for ownership and the final shared API.

## Verification evidence

The integrated Node suite passed 105 tests, including 17 Rally tests and 108,000 fixed steps representing 30 simulated minutes. Coverage includes tunnelling, corners, equal-time solid/goal priority, event and prediction caps, misses, stalls, repeated recovery, invalid state, ownership, cached onsets, inactive/Gentle behavior, deterministic replay and playhead-seeded reset. Independent review additionally exercised 50 seeds in normal and Gentle motion and identified the high-DPI picking defect fixed with a failing-then-passing browser regression.

Both TypeScript checks, repository lint, dependency audit and production build passed. HTTP verification passed 99 routes and 94 assets. The complete integrated browser matrix passed **223 checks with eight intentional platform-specific skips and zero failures** across desktop Chromium, Android-emulated Chromium and mobile WebKit. Rally accounts for **28 passes and two desktop-DPR-only skips**. The full log is `/tmp/hanging-final-browser.log`.

After the concurrent Odd Ensemble task's final additive changes, the shared foundation owner rebuilt once and reran the affected shared/Odd browser matrix: **57 passed, three platform-specific skips, zero failures** (`/tmp/hanging-delta-browser.log`). The latest Node suite was independently rerun here: **105/105**, retained at `/tmp/rally-integrated-final-node.log`. No Rally mechanics changed between these candidates.

The built Rally JavaScript is 13,409 bytes / 5,460 bytes gzip; its original SVG poster is 1,393 bytes. The associated extracted stylesheet is 1,871 bytes gzip. Babylon, HLS and the shared runtime are excluded from the concept-specific JavaScript figure, as specified by the TDD.

`desktop-performance.json` records a five-minute Chromium fixture run: 144 collisions, zero invalid recoveries, stable 32-mesh/32-draw-call counts, zero page errors and one paused/disposed media element after close. This was the pre-optimization renderer under concurrent browser/build load. Court markings were subsequently merged, reducing the renderer to 14 meshes/draw calls without changing collision geometry.

`live-cdn-performance.json` separately records 30 seconds of actual configured MX029 CDN playback with live analysis and zero page errors. Test WAV playback is not evidence of live audio. Browser media clocks and analysis were checked; subjective musical feel and acoustic output still need a human listening pass.

`desktop-final-performance.json` records five wall-clock minutes after mesh merging and the shared timing fixes: 155 contacts, one ordinary recovery, zero invalid recoveries, stable 14 meshes / 14 draw calls / 2,988 triangles and zero page errors. Close left zero canvases and the single fixture media element paused. `mobile-final-performance.json` records 65 seconds of Android-emulated Chromium with the same resource counts and cleanup. Both had p95 50 ms during concurrent browser validation/soaks; these measurements do **not** meet the settled frame targets or establish physical-phone performance. The longer live-CDN run is recorded separately.

The post-matrix mobile sample (`mobile-settled-performance.json`) measured p50 16.7 ms / p95 66.7 ms, with stable 14 draws, zero page errors and clean fixture close. A direct renderer probe confirmed **SwiftShader software rendering** on this Apple M1 Max / Chromium 159 environment; other passive soaks remained active. This is a measured performance limitation, not physical-GPU or physical-phone qualification. Mesh merging reduced 32 draws to 14 and DPR is capped, but the timing targets remain unmet in this environment. See `environment.json`.

The live 30-minute capture began before the final shared input/zoom/HUD and finite-feature guard changes. Rally physics, court geometry and rendering remained unchanged throughout; final browser checks exercise the later integration build. This is a passive-playback soak, not a thirty-minute interaction test of those later fixes.

**Completed live soak:** `live-30minute-performance.json` contains 180 samples over thirty wall-clock minutes of actual MX029 playback, ending at 30:03 of the 61:28 recording. All samples reported live analysis, finite values, monotonic simulation time/contact counts and stable 14 meshes / 14 draws / 2,988 triangles. The rally made **937 contacts**, with **zero invalid recoveries, zero resets and zero page errors**; no ordinary miss occurred in this untouched run. Deliberate misses and repeated recovery are covered by the browser and mechanics checks. Close removed every canvas; explicit media/context disposal is separately covered by the ten-cycle fixture tests. The final 60 seconds measured **p50 16.7 ms / p95 33.4 ms**, above the 20 ms desktop aim. Bounded clock drops under load left 1,738 simulation seconds after 1,800 wall-clock seconds; the scene never fast-forwarded or reset to catch up. Machine-readable checks are in [acceptance-summary.json](acceptance-summary.json).

The first complete repository browser matrix reported 200 passed, six skipped and four failures. The legacy ROOM001 CDN-start failure passed its isolated retry; shared timing/resize defects were corrected; the reduced-motion emulation test now waits for each actual OS-preference transition. Further zoom investigation found that inert Labs content could widen mobile coordinates despite a visually fitting dialog. The shared modal now locks/restores root overflow as well as body overflow; Rally's 200% regression checks the visible client width and an actual touch-button action after enlarging text. These distinctions are retained rather than presenting the initial full run as clean.

Final screenshot scenarios passed again on all three browsers after the integration rebuild (`/tmp/rally-final-captures.log`, 3/3). Screenshots: [desktop Watch](chromium-watch.png), [manual control](chromium-manual.png), [Returning](chromium-recovery.png), [mobile court](mobile-webkit-watch.png), [mobile Returning](mobile-webkit-recovery.png), and [mobile controls / transport](android-controls.png). Manual control is paused for a stable inspection frame, with Keep control selected and the paddle displaced; mix playback continues. Desktop states and mobile court/controls received independent visual review; the refreshed mobile recovery frame was also inspected directly.

## Limits

Browser coverage uses desktop Chromium, Android-emulated Chromium and mobile WebKit on this Mac; it is not physical-phone or hardware-GPU performance evidence. Both the accelerated 30-minute mechanics soak and the actual 30-minute live-CDN browser soak completed. Frame-time aims were not met in the software-rendered environment despite the mesh reduction and DPR cap. Human listening quality, acoustic close verification, physical-device touch/performance and full-recording validation remain unqualified. No deployment, push, PR, season mapping or public game route was performed.

## Reproduce

Use Node 24. Run `npm run build`, then `PORT=4192 node scripts/serve.mjs`. Run `node --test test/listening-toy-runtime.test.mjs test/endless-rally.test.mjs` for mechanics and `ROOM_TEST_ORIGIN=http://127.0.0.1:4192 npx playwright test e2e/endless-rally.spec.cjs` for browser checks.

`scripts/rally-evidence.cjs` records a default five-minute fixture run. Set `RALLY_SOAK_SECONDS=65` for a frame sample, `RALLY_MOBILE=1` for mobile emulation, or `RALLY_LIVE=1` for the configured live CDN. Validation output must pass through `compress` with a focused question and preserve failure status with `set -o pipefail`.
