# Structural intervention — Task 06

19 November 2026. Development baseline `audio-structure`, **Structural intervention**, under Labs → Audio experiments. Branch `codex/audio-structure`, based/rebased on fetched master `254426f`. The original `/Users/pmarko.alt/room.haus` checkout contains unrelated dirty work and was preserved. Prepared for code review; generated audio and screenshots remain local. No deployment or public-season integration.

## Listening and control contract

Play the selected source explicitly. Hold **Thin** or **Fill**; for **Repeat**, first press **Listen for fragment** and allow at least 125 ms to reach the shared source ring. Keyboard Space/Enter are momentary, pointer capture preserves release outside the button, and assistive synthetic activation starts one bounded audition. Maximum duration is 0.5–2 seconds (default 1); strength is the shared 0–1 dry/processed balance (default 0.5). At strength 1, repeat/fill fully replace the audible source during the interior of the action. Lower strength retains more of the live recording. No tempo or alignment claim: all three actions are explicitly **free time**. Any future beat option must use the shared manual tempo and deliberate media-phase anchor.

The source never stops underneath an intervention. Exit returns to its **current** position through the existing fixed-headroom output. Application code has no transport writes, media element, AudioContext, destination connection or new capture implementation. Original, Stop effects and Reset use the existing owner; Reset restores this experiment's settings. No Task 05 UI or fragment controller dependency.

| Action | Minimal treatment | Continuity mechanism | Candidate disruption to audition |
| --- | --- | --- | --- |
| Repeat | Newest 125 ms of source, repeated for the bounded hold | Stereo preserved; 15 ms fragment boundaries and outer envelope; no playback-rate change | A vocal syllable or melodic attack may become a conspicuous repeated object; 125 ms is not a beat grid |
| Thin | Gain alternates every 125 ms, with an 18% floor | 15 ms slopes; source rhythm/pitch retained; partial strength leaves dry context | Fixed free-time chopping can conflict with a swung groove or obscure a long note |
| Fill | Four sparse rim/closed-hat/snare/closed-hat hits distributed across the duration | One finite phrase, outer envelope, no future queue | Full replacement removes bass, harmony and room sound, creating a substantial level/context dip even with smooth fades |

These are **candidate findings for listening**, not reports that a person found them expressive or disruptive. No human listening review was performed. Numerical continuity is established below; groove, perceptual loudness and arbitrary DJ passage suitability remain open. No automatic drops, segmentation, sequencer, beat detection or stretching.

## Ownership, bounds and recovery

One accepted press owns pending capture, active output and release. Other presses do not replace it or extend its deadline. Matching input tokens alone can release it; stale/secondary pointer releases cannot cancel a newer action. Key repeats are ignored. Pointer cancellation, lost capture, key focus loss and window blur cancel. A short 40 ms return interval prevents re-entry into retiring nodes. A held gesture cannot auto-repeat after timeout; release and press deliberately again.

Every accepted action has one cleanup timeout, a shared-clock cancellation generation and a finite AudioContext deadline. The processor schedules its return to unity at that deadline, and one-shot material ends there. This restores Original even while JS is stalled. State reconciliation also expires the lease against current audio time, so a throttled timeout cannot leave controls claiming active output or rejecting new gestures indefinitely. Capture resolution checks both the current lease and shared generation; early release, bypass, interruption and close reject stale results.

Capture is the foundation's one-second **source** ring, not output feedback. Only its newest 125 ms is retained transiently. Repeat/fill use the owner's tracked `playBuffer`, one finite voice; there is no loop flag or subscription queue. Maximum prepared repeat is two seconds of stereo PCM: 1.536 MB at the supported 96 kHz ceiling. Trimming can temporarily allocate another equally bounded copy; the 125 ms capture and one-second ring are separate bounded allocations. Interruptions release controller references and the foundation fades/stops tracked voices. Kit generation has no network load; allocation/generation failure is caught before audible replacement and returns Original. Capturing silence or an incomplete fragment similarly fails safely.

The shared processor slot is unity during capture-only listening, a gate during Thin, and silent during replacement. Captured one-shot PCM is scaled by four to compensate the foundation's 0.5 per-voice × 0.5 layer attenuation at full strength; the fixed 0.5 output headroom is retained. This is routing compensation, not normalization or a source-volume increase. Fill uses the existing generated approximations and their manifest/license at `src/experiences/shared/audio/research/materials.manifest.json`; they are not authentic TR-909 recordings. No shared API changes were needed.

## Evidence and local examples

`scripts/audio-structure-evidence.mjs` obtains a real pre-effect capture of the explicit generated diagnostic loop through ResearchAudio. It then renders the production controller/processor and finite material in offline Web Audio with the same dry/wet/layer/headroom gains. The guard and tracked voice admission are exercised separately in real ResearchAudio browser graphs. Offline examples omit the guard and stay below its ceiling; they must not be presented as worklet output recordings.

Seven four-second stereo PCM16 WAVs are local in ignored `artifacts/audio-structure/`: `reference-original.wav`, and `reference-{stutter,thin,fill}-{0.5,1}.wav`. The one-second intervention runs at 0.5–1.5 seconds; the source advances throughout. No normalization. See `structure-measurements.json` for source position, capture properties, checksums, peak/RMS and exact post-return error. The same generated source is used for Original and each comparison. The full-strength versions are deliberate counterexamples for audition, not recommended settings.

Measured in this snapshot: all seven renders are finite, peak ≤0.375, and match Original sample-for-sample after 1.51 seconds (`returnMaxError=0`). A 0.2-peak 317 Hz sine returns to RMS ≈0.07071 through the real guarded path after each action, with zero active voices and Original state. The offline constant-signal gate test caught a 0.164 final discontinuity before correction; the final slope is below the 0.002/sample acceptance threshold. Unit checks also verify softened stereo repeat boundaries, deterministic bounded fill material, failed capture/kit fallback and cancelled late reads. These are measured signal results, not a listening qualification.

Control screenshots: `artifacts/audio-structure/controls-<browser>-{390,768,1440}.png`. Final overview/control captures are in the same directory. Tests cover keyboard holds/releases, pointer-owner overlap and stale release, cancellation, blur, reduced motion and actual 200% text. Pointer events are browser automation; physical multi-touch/hardware latency are unqualified. Native WebKit HLS stays on its existing audible path with interventions disabled. Explicit processable reference playback exercises the interventions in mobile WebKit emulation.

## Verification

The internal spec `e2e/audio-structure.spec.cjs` is explicitly included in `playwright.suites.cjs`. It covers real source progression/rate, pause, native seek, buffering, Original/Stop/Reset and close during **each** intervention; native unsupported fallback, missing Web Audio and failed named-chunk retry; real guarded output after a long JS stall; offline smooth return; and responsive/input states. No shared/public audio routing code changed. Shared-foundation regressions and final gate results are recorded after the final candidate checks below.

Final candidate checks: **143/143 Node tests**, both TypeScript checks, lint,
dependency policy, production build and **99 HTTP routes / 94 assets** pass.
The combined Task 06 + foundation browser matrix passed **35, with 4 intentional
platform skips**; all 18 Task 06 cases passed across Chromium, Android emulation
and mobile WebKit emulation. Fresh inventory is **174 public + 303 Labs = 477**,
zero overlap or omissions. This is not a run of the full 477-case browser suite.
Concept lazy JS is 21,072 bytes / 7,359 gzip, below the 40 KB gzip ceiling, with
no new dependencies. Source owner/clock/capture/transport files are unchanged.
Six strengthened signal checks then passed across all three projects: stutter
remains audible with the live input muted after capture, thinning reduces actual
signal energy, fill remains sparse, and the constant-signal gate both changes
the body and returns smoothly. Logs are local in `artifacts/audio-structure/`;
foundation-generated regression artifacts were retained there without replacing
the repository's historical foundation screenshots.

Independent read-only review found one important state-liveness defect:
audio returned on time, but a delayed cleanup timer could retain the gesture
lease. A new test reproduced this RED, and audio-time expiration in reconciliation
made it GREEN; the full Node suite and final browser matrix passed afterward.
The earlier intermittent WebKit processed-state assertion prompted this check;
it was not an observed failure of the finite audio return. The review found no
other concrete implementation bug and did not judge musical quality or physical
device behavior. Final screenshots also verify 45 px action targets and no mobile
horizontal overflow. Actual listening acceptance remains open.

Reproduce locally:

```sh
npm ci
npm run build
PORT=4278 node scripts/serve.mjs
# In another terminal:
ROOM_TEST_ORIGIN=http://127.0.0.1:4278 npm run test:browser:labs -- e2e/audio-structure.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4278 node scripts/audio-structure-evidence.mjs
node scripts/check-routes.mjs http://127.0.0.1:4278
```

Open `http://127.0.0.1:4278/labs/#audio-experiments`. The existing local Labs gate is unchanged. Select the generated diagnostic loop for a self-contained reference; the default MX029 source is never silently substituted by application code.

## Future mappings, still proposals

- Hanging Balance: a short displacement could thin the sound, returning on release. Keep passive motion audio-neutral unless an explicit audio mode is chosen.
- Endless Rally: a deliberate player gesture could request one finite fragment repeat; ordinary autonomous rallies should not keep retriggering it.
- Odd Ensemble: an intentional pull/release could request a sparse fill, with shared gesture ownership and a conspicuous Original escape.

All require separate design/listening work and the same source-preserving owner. No existing interactible was changed. Next useful audition: compare 0.5 vs 1 strength and 0.5 vs 2 seconds on an established drum passage, a vocal entrance and a long sustained texture; log the exact passage and actual listener response. In particular, determine whether the quiet full-replacement fill reads as useful space or accidental dropout before extending its mappings.
