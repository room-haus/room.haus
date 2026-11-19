# Additional rhythm implementation plan

**Goal:** Task 03's local, deliberately aligned rhythm baseline; the user prompt and common brief are the selected design. The initial delivery kept all work local; the subsequent user instruction authorizes commit, push and a pull request. Deployment remains outside scope.

**Architecture:** Reuse ResearchHost and the existing ResearchAudio layer/voice owner. A layer module consumes AudioClock's quarter-beat callbacks and grid indices; it never owns a timer, context or transport. Three generated kit buffers, bitmask steps and three sparse patterns. No swing in this pass.

**Constraints:** Added sound starts off; 100ms horizon, 16 shared active plus retiring voices, deliberate re-anchor after every interruption. Manual tempo and phase only. Existing source never replaced implicitly. Preserve all unrelated checkout work; base is origin/master de4d70f.

- [x] Test quarter-beat indices, exact hit times at 120 BPM, 60s fixed-grid drift, stalls, phase shifts and cancellation. Extend the shared callback with the existing integer grid index; keep earlier callback arguments unchanged.
- [x] Implement `src/experiences/audio-rhythm/layer.ts`: three buffers, 16-step lane masks, safe levels, one shared subscription, no new scheduling owner. Browser tests verify actual output and future cancellation through ResearchAudio.
- [x] Implement `index.tsx`, scoped CSS, poster and `audio-rhythm` named registry loader. Reuse host transport/comparison with optional labels and pass current media time into controls. Show manual BPM/tap/anchor/nudge and off/re-arm status. Steps are optional detail; defaults are sparse hats with no kick.
- [x] Add internal browser coverage for supported/native fallback, interruption/re-arm, source replacement, retry, keyboard/reduced motion, 390/768/1440/200% layouts. Run focused coverage plus foundation tests because the callback/host contract changes.
- [x] Generate local original/layer audio and measurements using shared kit, deterministic loop and hash-verified MX029 excerpts. Record manual alignment and live-mix drift limits honestly; no subjective listening claim from signal measurements.
- [x] Run all unit tests, both type checks, lint, dependency policy, production build and HTTP routes. Review diff and document findings in `docs/audio-research/additional-rhythm.md`.

Review focus: stale subscribed callbacks after edits; nudge causing duplicate/downbeat replay; already-scheduled sources surviving Stop; rapid re-arms exceeding voice bounds; generic host arming a silent/unanchored layer. Tests must distinguish armed from anchored and require an explicit anchor after cancellation.

Final evidence: 130/130 Node; 24/24 rhythm E2E across focused runs; 70/75 existing audio E2E with five intentional skips; both types/lint/dependency/build/routes passed. Final fallback-copy delta: 38pass/4skip, followed by3/3 actual7s media transport drift checks. Independent review found queued nudge dropout; real-owner RED→GREEN replacement regression verifies the fix. Calibration RED→GREEN requires useful attack output. Musical listening and live-mix beat alignment remain unreviewed; documented explicitly.
