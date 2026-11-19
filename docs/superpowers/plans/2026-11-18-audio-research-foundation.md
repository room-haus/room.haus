# Shared audio research foundation implementation plan

**Goal:** Supply the six audio baselines with an opt-in extension of the existing source owner, without changing public or visual-only playback.

**Architecture:** ListeningSession opts its AudioController into a ResearchAudio graph attached by HLSAudioSource. Pre-effect analysis remains separate. One processor, one layer module, bounded tracked voices, a finite/clipping output worklet and optional pre-effect rolling capture share the existing AudioContext. A small DOM reference panel uses the existing registry and modal.

**Spec:** `../prompts/2026-11-18-audio-research/00-shared-foundation.md` and COMMON.md. User authorized implementation; routine choices remain here, no commit/publication.

**Base:** codex/listening-prototypes, 9b4ae30. Existing untracked prompt pack preserved. Work happens in this existing worktree.

**Review publication:** Following local delivery, the user requested a PR. The implementation is prepared on codex/audio-research-foundation against master after the prerequisite listening host merged. The prompt pack remains untracked and excluded; no deployment is authorized or performed.

## Constraints and review focus

- One media element/context; default direct path unchanged. Native WebKit HLS retains native output.
- Research Original uses the same fixed headroom as Processed; exactly one dry connection. Processing requires a working final guard.
- Interruptions (pause, seek, buffering/error, visibility, retry, close) cancel generations, tails, voices and capture; re-arm explicitly.
- Async guard/capture initialization and capture replies must not resurrect a detached graph.
- Meter/control changes cannot establish audibility. Render known signals and exercise native fallback; label listening limits.
- Kit is generated, identified as approximations, lazy and bounded; no dependencies or purchases.

## Work items

- [x] 1. Write failing deterministic tests for scheduler, fixture bounds/provenance and module ownership; run red. Implement AudioClock, fixtures and bounded research graph APIs; run green.
- [x] 2. Integrate opt-in source/controller/session lifecycle. Add internal browser specs before implementation to exercise real output routing, native fallback, cancellation and repeated close.
- [x] 3. Add the plain development reference launcher/panel, generated starter kit manifest, output diagnostics and shared controls. Inspect 390/768/1440, keyboard, 200% text and reduced motion.
- [x] 4. Render and measure known-input Original/Processed paths, exercise public player regressions, run repository gates and focused internal browser tests. Review changes independently, correct consequential findings and record actual evidence/hash manifest in shared-foundation.md.

## API decisions

- `new ListeningSession(url, {research:true})` exposes `session.audio.research`.
- `ResearchAudio.install(kind, factory)`, `update(kind, params)`, `arm()`, `original()`, `stop()`, `reset()`, `setLevel(value)`, `playBuffer(buffer, when, level)`, `startCapture(seconds)`, `capture(seconds)`, `diagnostics()`. Modules receive tracked node scope and return input/output/update/reset/dispose; no transport/context creation.
- `AudioClock.setTempo(bpm)`, `tap(mediaTime)`, `anchor(mediaTime)`, `repeat(beatDivision, callback)`, `sync(audioTime,mediaTime,running)`, `cancel()`. 100ms horizon, 25ms owner timer, four subscriptions, skip stale events.
- Guard and capture worklets are copied to one local worklet asset. Capture max8s/stereo/96kHz; unavailable independently when unsupported.

## Progress

Implementation verified:121Node tests; bothTS; lint/dependency/build;99routes/94assets;17foundation browser passes/4expected platform skips;18focused public-player regressions;12additional shared-host/modal/layout regressions. Independent review's buffering and retiring-voice findings reproduced and fixed. Source-capture fidelity corrected with red/green test. Source hashes and actual output measurements are in artifacts/audio-research; complete handoff docs/audio-research/shared-foundation.md. Final control captures and real shared-path audio exports succeeded. Technical foundation is available to dependent tasks on the hashed snapshot; no human musical listening approval is claimed.

Routine choices: existing worktree preserved; no commits/publication per COMMON; fixed−6dB comparison headroom,15ms ramps,100ms scheduling horizon, bounded optional stereo capture, generated kit. Deterministic render/output evidence is kept separate from unperformed human musical listening review. A browser test that attempted to intercept worklet network loading did not intercept AudioWorklet requests; it was replaced by a deliberate addModule initialization rejection and a real fallback-output measurement. No production behavior changed to accommodate that test.
