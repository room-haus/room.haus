# Memory & fragments handoff implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Check a step only after its evidence exists.

**Goal:** Capture one distinctive stereo fragment from MX029, open its take on a second device, move the playback gesture, change its treatment and share a child that still contains the exact samples the maker captured.

**Architecture:** Extend the [accepted Space handoff](./2026-11-19-space-take-handoff.md) with one Memory recipe and one lossless fragment representation. Keep capture identity, treatment and trigger time separate. Use Space's preparation, durable publication, public player and editor entry points.

**Tech stack:** The Space stack, the existing Memory windowing and seeded grain functions, canonical stereo PCM, SHA-256 and browser signal tests.

**Spec:** [Approved handoff design](../specs/2026-11-19-shareable-audio-takes-design.md).

## Implementation status

All five tasks passed independent local review. The final integration review covered the complete implementation through `fda1bee`. The two real MX029 handoffs exercised desktop Chromium and mobile WebKit in both directions, retained their stereo samples through editing and replay, and reopened after the take service restarted. The local Space handoff satisfied the prerequisite. Hosted verification resumes after the existing backend handoff. Physical Safari and listening by ear remain open. [Playable examples and sample-level evidence](../../audio-research/memory-take-handoff.md)

## Global constraints

- Start after Space milestone S8. A Memory take uses one experiment, one exact MX029 passage and the same public, anonymous forwarding and variation flow.
- Capture recent **pre-effect** audio explicitly. Preserve both channels, sample order, frame length and sample rate across devices. The identity check operates before treatment, final mix gain and device resampling.
- Stay inside the inherited passage. An edited trigger can move independently of the captured source interval. Keep capture bounded and interruptible. Keep unreferenced draft captures out of a shared take.
- Retain Space v1 and its existing links. Read source instructions, check architectural constraints before code changes, apply app-design-principles for UI and use the repository's shell compression convention. Commit after each task's checks pass.

## Review focus

1. Identical left/right test material hides a channel swap or downmix (M1, M5).
2. A capture spans a source chunk boundary, or a seek lands during a pending capture (M1, M3).
3. Changing treatment or moving a trigger accidentally re-captures from the new playhead (M2–M5).
4. Native output resamples to another rate, or seek enters an already-sounding grain (M2, M5).
5. Deleting the last child reference or expiring an unpublished preparation damages a retained parent (M3, M5).

## File and interface map

Reuse Space's `src/experiences/takes/{source,recipe,edits,render}.mjs`, editor, transport and comparison player, plus `services/takes/{passage,handler,repository}.mjs`. Existing `src/experiences/audio-memory/fragment.ts` contains separate source, repeat and eight grain buffers. Its current live module disposes material on stop and changes the shared clock on play. Keep that cleanup for the existing research mode. The take stores a durable source fragment independent of its live player.

### M1. Pin exactly what the maker captures

**Files:** Create `src/experiences/takes/fragment-asset.mjs`, `test/take-fragment-asset.test.mjs`; extend `src/experiences/takes/transport.ts` and `services/takes/passage.mjs`.

**Interfaces:** `captureFragment(sourcePCM, passage, endFrame, lengthFrames)` returns `{ref, pcm}`. `ref` records source revision, absolute capture start/end frames, rate, two channels, format and digest. Hash the canonical interleaved little-endian stereo PCM16 payload; validate declared format and length independently. Store it losslessly. Browser and service use identical byte order.

- [x] Write RED sample-exact tests with different transients in each channel, a known fixed digest, a chunk boundary inside the capture, and two different positions containing the same samples. Check that coordinate provenance stays distinct even if asset bytes deduplicate. Run `node --test test/take-fragment-asset.test.mjs`.
- [x] Use the canonical pre-effect source PCM already loaded for the chosen passage. When recent listening is armed, track continuously heard frames for up to four seconds using the transport; capture a complete 0.25–2 second window ending at the observed source frame. An explicit capture freezes those exact bytes. Check them before any windowing, gain, encoding or output-rate conversion. Invalidate the recent window on seek, pause, source change or clock discontinuity. Reject partial, silent and stale reads with recoverable UI state.
- [x] On the service, reconstruct the canonical slice from the pinned revision and frame bounds; check client digest, stereo format and length. Reject references outside the take passage or to a different revision. For the child's inherited materials load the parent's durable reference and validate it. Test capture during 44.1 kHz device output against the same 48 kHz source frames and run the asset tests green. Commit.

### M2. Render the fragment independently of the playback gesture

**Files:** Create `src/experiences/takes/memory-render.mjs`, `test/take-memory-render.test.mjs`; extend `src/experiences/takes/{recipe,edits,render}.mjs`. Extract reusable window and grain rules from `src/experiences/audio-memory/fragment.ts` into `src/experiences/audio-memory/material.mjs` and retain compatible exports for existing callers.

**Interfaces:** Memory gestures carry `id,startFrame,endFrame,fragmentRef,treatment,density,level,seedVersion`. `renderTake(recipe, sourcePCM, materials)` accepts verified material keyed by digest. The fragment's own start/end refer to the capture in MX029. A gesture's start/end refer to playback in the take.

- [x] Add RED tests: move a repeat by a known frame delta; assert the added signal shifts by that delta and the source fragment bytes/digest are unchanged. Switch to dissolve and assert the audible layer changes but source bytes stay equal. Use non-silent asymmetric samples and a dry subtraction to isolate the layer. Run `node --test test/take-memory-render.test.mjs`.
- [x] Reuse the existing 15 ms repetition edge window, eight 200 ms Hann grains, 62.5 ms free-time step, bounded density 1–8 and seeded choices. Store a renderer/seed version. Use the shared transport and passage-relative frames; derive the event schedule from the gesture and fragment. Include the existing 25 ms onset offset exactly once in a documented timing convention. Bound playback by the gesture, twelve-second cap and passage out point. Use the same schedule for live audition and prepared rendering.
- [x] Test independent event schedules after seek, repeat/dissolve outcome across render block sizes, no stale voices after interruption, same digest after changing level, and exact copy of both prepared references on a no-edit fork. Retain the existing Memory safety bounds. Run the new tests plus `node --test test/audio-memory.test.mjs test/take-space-render.test.mjs`. Commit.

### M3. Publish and retain the exact referenced material

**Files:** Extend `services/takes/{handler,repository}.mjs`, `src/experiences/takes/recipe.mjs`; create `test/take-memory-publish.test.mjs`.

**Interfaces:** Extend the established preparation response and published manifest with a fragment table of verified refs and immutable asset descriptors. A child may refer to an inherited fragment or a new verified capture within the same passage. Public fetches deliver the exact stored bytes. Reissue transient fetch URLs through the durable take ID.

- [x] Write RED API tests for a parent using fragment A twice, a child moving one A trigger, a second child removing every use of A, and an unreferenced capture B. Destroy the creating session, restart the service, then independently read both channels of A via the parent. Assert B is absent from the published manifest. Run `node --test test/take-memory-publish.test.mjs`.
- [x] Publish only the reachable fragment descriptors alongside the dry and performed assets using S5's manifest-last conditional write. Reusing content-addressed bytes does not change the parent manifest. Reject digest mismatches, malformed material, unknown treatments/versions and mixed experiments before returning a link. Verify fragment fetches as part of the independent readiness check.
- [x] Exercise failure between fragment and manifest writes, concurrent retries, expiration of a failed preparation, and an edited or removed trigger. Assert the parent and any other shared take still resolve. Benchmark worst-case distinct captures and granular events within measured Space limits; cap verified decoded bytes, events and active voices before allocation. Run publish tests against the local adapter. Commit.
- [ ] After the backend handoff, repeat the publication tests against the hosted preview.

### M4. Make capture and editing legible on the same timeline

**Files:** Create `src/experiences/takes/MemoryControls.tsx`, `e2e/take-memory-maker.spec.cjs`; modify `src/experiences/audio-memory/index.tsx`, `src/experiences/takes/{TakeEditor,Timeline}.tsx` and `playwright.suites.cjs`.

**Interfaces:** MemoryControls uses the S4 transport with M1 capture and M2 playback. The editor owns the draft's fragment table; capture readiness, retained material, currently audible treatment and selected gesture are independent state. Register the maker spec in Labs.

- [x] Write the RED maker flow: start recent listening, capture a distinctive hit, perform its repeat trigger, compare with Original, move it, change to dissolve and remove a trigger using the keyboard. Assert the capture's original source range and identity next to the new trigger time. Build and run `npm run test:browser:labs -- e2e/take-memory-maker.spec.cjs`.
- [x] Integrate the same editor/player with Memory's launcher and public variation route. Provide concise pending/ready/playing status, a clear capture retry and an explicit discard for unreferenced material. Original/Take changes the monitor only. Stop, blur and cancellation release live voices and invalidate pending work while preserving already committed draft material. Keep pointer and keyboard alternatives, available actions and focus return coherent on phones.
- [x] On public open, fetch and verify the published fragment before enabling its edits. If one material is missing or corrupt, keep playable rendered references available, identify which edit cannot proceed and allow retry. Never silently recapture the new playhead. Run maker and existing Memory browser specs across configured projects and commit.

### M5. Verify sample identity and musical identity on the second device

**Files:** Create `e2e/take-memory-handoff.spec.cjs`, `scripts/check-fragment-handoff.mjs`, `docs/audio-research/memory-take-handoff.md`. The recipient spec stays in the public suite.

- [x] Create a RED public journey from an independently prepared, known stereo fixture. Open the forwarded link without storage or sign-in. Compare Original/Take, move the trigger, change treatment, share and reopen both links. Fetch published bytes independently of the editor; recompute SHA-256 and compare channels sample-for-sample to the fixture and to the captured source interval. Check that the child's wet signal moved and the parent's playback is unchanged. Run `npm run test:browser:public -- e2e/take-memory-handoff.spec.cjs` after building.
- [x] Run the real MX029 journey locally with desktop Chromium and mobile WebKit, swap maker and editor, then reopen the saved links after a service restart. Record source revision, capture and trigger frames, stereo digests, and the independent full-passage waveform comparison for both pairs.
- [x] Exercise retry and a capture spanning a chunk boundary. Rerun the Space public handoff, Memory maker and public suites, and the repository validation gates. Record the device and listening evidence separately.
- [ ] After the backend handoff, repeat the public journey on the hosted preview with physical mobile Safari as both recipient and maker.
- [ ] Have listeners compare the parent and child against Original and describe the captured sound, its timing, and the change in treatment.
