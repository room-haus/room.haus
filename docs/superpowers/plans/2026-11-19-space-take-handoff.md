# Space & echoes handoff implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Check a step only after its evidence exists.

**Goal:** Hand a real MX029 echo performance to someone on another device who can hear the same selected passage, move the throw and send back a variation.

**Architecture:** Prepare MX029 once as an immutable, seekable stereo source. Record timed sends in the browser, prepare aligned dry and performed audio from the validated recipe, and publish the exact prepared assets the maker auditioned. Serve the public player from ROOM's existing static release and place the durable take API and data outside the release prefix.

**Tech stack:** React, TypeScript, Web Audio, portable JavaScript DSP, Node 24, ffmpeg, Webpack and Playwright. Proposed hosting is a small AWS HTTP API and Lambda with private S3 objects. Use a filesystem adapter for local development and CI.

**Spec:** [Approved handoff design](../specs/2026-11-19-shareable-audio-takes-design.md). Begin here. [Memory follows after the Space handoff](./2026-11-19-memory-fragment-handoff.md).

## Global constraints

- One experiment per take. MX029 permits selection anywhere from frame zero to the end. Start with 35:00.218–35:08.218. Use 15:00.093–15:08.093 for the denser listening comparison.
- Treat source bounds as half-open integer frames. Preview, Original, Take and the variation have the same length and endpoints. Cut tails at the out point. A child inherits its parent's passage.
- New makers enter through Labs. A forwarded link supports listening, variation and publication without a login or prior browser state. Each published version is immutable.
- Keep live recording, editable gestures, common-gain A/B, touch and keyboard support. Preserve the other Labs experiments, normal archive playback and the existing Space delay/reverb study.
- In the execution checkout, read its instructions, run the architectural-constraint memory lookup before code changes, and apply app-design-principles to the player/editor. Run commands with repository shell-output compression and pipe failure propagation. Commit each task's listed changes after its checks pass.

## Review focus

1. A range straddles an HLS boundary or ends on the final source frame (S1, S8).
2. A touch is cancelled or the audio clock is interrupted during an overdub (S4).
3. A listener seeks into a previous echo tail or switches modes mid-transient (S3, S6).
4. Two publish requests race, or a worker fails between storing audio and making the link visible (S5).
5. A fresh Safari session needs editable audio and a published link must survive an application version change (S6–S8).

## File and interface map

Existing integration points are `src/experiences/audio-space/index.tsx`, `src/experiences/audio-space/processor.ts`, `src/labs/experiences.js`, the explicit Webpack entries and HTML templates, and the shared local/CloudFront route lookup in `scripts/routing.mjs`. For focused browser runs, build first and use the Playwright server or set ROOM_TEST_ORIGIN to the built test server; configure its fixture take service in S5/S6 for the public suite, including CI. Put the shared editor and model under `src/experiences/takes/` where the current TS and Babel rules apply. The new service lives under `services/takes/`; the Node API and browser can import pure `.mjs` contracts from the take directory. Files below are relative to the repo root. S1/S2 feed S3; S3 feeds S4/S5; the complete user journey needs all eight tasks.

### S1. Produce and slice a versioned full-mix source

**Files:** Create `scripts/prepare-take-source.mjs`, `src/experiences/takes/source.mjs`, `services/takes/passage.mjs`, `test/take-source.test.mjs`. Reuse `scripts/lib/audio-processing-sources.mjs` and `scripts/fixtures/audio-processing-passages.json`.

**Interfaces:** Produce `SourceRevision {id, revision, sampleRate, channels, totalFrames, chunks, peaks, curatedRange}`. Each chunk records its first frame, length and content digest. `readPassage(catalog, {sourceId,revision,startFrame,endFrame}, store)` returns canonical interleaved stereo PCM with its format.

- [ ] Add RED tests on a tiny asymmetric stereo source for `slice(0,1)`, a slice across two chunks, and `slice(N-1,N)`. Assert samples against a continuous independent decode. Reject empty, fractional, negative, out-of-range and unknown-revision requests. Run `node --test test/take-source.test.mjs` and see the missing reader fail.
- [ ] Pin the MX029 playlist and every referenced segment by digest during preparation. Decode the playlist continuously with ffmpeg to 48 kHz stereo signed 16-bit little-endian PCM; then split into indexed chunks. Store the decode settings, tool version and canonical content hash. Keep generated mix data outside Git and `dist`. Build multiresolution waveform peaks in the same coordinates. Fail on an unexpected source revision. Reuse verified downloads. The three existing excerpt fixtures alone cannot serve this task.
- [ ] Map the fixture's precise timestamp to the canonical timeline, checking actual alignment against the decoded material (including stream start/encoder delay). Pin the verified start frame and an eight-second length, plus the dense reference. Regenerate twice and compare digests. Record opening, non-curated cross-boundary and final-frame results on full MX029. Run the focused test green and commit.

### S2. Define the immutable recipe and timeline edits

**Files:** Create `src/experiences/takes/recipe.mjs`, `src/experiences/takes/edits.mjs`, `test/take-recipe.test.mjs`.

**Interfaces:** `RecipeV1 {schema:1, experiment, rendererVersion, passage, initialSettings, gestures, parentId}`; a Space gesture has stable `id`, relative `startFrame/endFrame`, and effective delay frames, feedback, wet level and stereo width. `validateRecipe(recipe, catalog, parent, limits)`, `editGesture(recipe, operation)`, `forkTake(published)`. Store public IDs separately from recipe identities.

- [ ] Add RED tests that move hit 3 to hit 4 while preserving duration and settings, add a touching interval, reject an overlapping active send, remove an event, and leave the parent byte-for-byte unchanged. Reject a forged child passage/experiment, duplicate IDs, unsupported versions and nonfinite values. Run `node --test test/take-recipe.test.mjs`.
- [ ] Implement pure updates, stable serialization and validation used by both client and service. Store manual-tempo delay as its resolved interval. Compare against the actual stored parent on the server. Choose a visible error for edits beyond an endpoint. Re-selecting a passage with recorded gestures starts a separate draft after explicit confirmation.
- [ ] Test zero gestures as a valid Original-sounding edit, touching sends with overlapping *tails*, and a copied recipe that round-trips through JSON. Run the focused test green and commit.

### S3. Make a throw audible live and reproducible in a prepared take

**Files:** Create `src/experiences/takes/space-render.mjs`, `render.mjs`, `space-worklet.mjs` (all in the same directory), and `test/take-space-render.test.mjs`. Reuse or extract compatible Space settings from `src/experiences/audio-space/processor.ts`. Bundle the worklet as its own loadable entry in `webpack.config.js`.

**Interfaces:** `createSpaceVoice(sampleRate, effectiveSettings)` processes stereo blocks with a timed input gate; `renderTake(recipe, sourcePCM, materials)` returns aligned dry/take stereo PCM16 at source rate plus peak and return-energy measurements. The browser worklet and Node renderer share the versioned throw DSP.

- [ ] Add RED signal tests with stereo impulses before, during and after a press. Assert dry survives all three, only the middle impulse excites an echo, repeats continue after release and both outputs contain exactly `endFrame-startFrame` frames. Run `node --test test/take-space-render.test.mjs`.
- [ ] Apply the calibrated Space filter, bounded feedback, send gain and stereo behavior from the existing processor. Gate the input to each throw; retain its settings through the tail. Use a common 0.5 output gain and the existing 0.98 guard ceiling for both modes. Quantize once on output. Test empty/zero-level recipes for sample equality. Keep v1 render behavior available for existing links when introducing another version.
- [ ] Check that splitting the render into arbitrary block sizes produces identical canonical PCM. Compare captured live worklet output and the prepared render at matched rates on the impulse fixture for onset, level and tail. At a different hardware rate verify elapsed time and audible balance against the prepared reference. Run the render test and `node --test test/audio-space.test.mjs` green and commit.

### S4. Record and edit by ear inside the Space launcher

**Files:** Create `src/experiences/takes/TakeEditor.tsx`, `Timeline.tsx`, `transport.ts`, `takes.css` (same directory), `e2e/take-maker.spec.cjs`. Modify `src/experiences/audio-space/index.tsx` and `playwright.suites.cjs`. Register maker tests in Labs.

**Interfaces:** `TakeEditor({draft, loadPassage, prepare, publish})` owns a draft revision; `transport.positionFrame()` maps the audio clock to canonical source frames. Use in-memory fixture adapters in this task, then wire the service in S6. Reuse the existing Space launcher; put the record-first experience first and retain access to the continuous research controls. Dispose the current playback owner on switches.

- [ ] Add a RED Playwright flow at 390 × 844: open Space, play the curated passage, see Record/Echo within the first viewport, press/release on a known hit, then add, move and remove throws with keyboard controls and time readouts. Build and run `npm run test:browser:labs -- e2e/take-maker.spec.cjs --project=chromium`.
- [ ] Render the full-mix overview with range handles and numeric in/out access; load only the selected PCM into the editor. Use canonical pre-output-gain PCM for editing. Timestamp input against the running audio clock, convert to source frames, and audition existing gestures during overdubs. Capture effective settings at press time. Label recording, sending and tail states separately. Commit the pass at its end; cancellation closes the held gesture. Drop only the provisional pass on clock discontinuity, context loss or untrustworthy timing.
- [ ] Exercise touch cancellation, blur, repeat keydown, end-of-passage release, a second pass, source changes and stale async loads. Ensure Stop silences all output, compare preserves the draft and a closed modal frees the audio owner. Check keyboard focus, enlarged text and mobile reach. Run the new maker spec in all three configured projects and the existing Space browser spec. Commit.

### S5. Prepare and publish immutable takes through a local service

**Files:** Create `services/takes/{handler,repository,file-store}.mjs`, `test/take-publish.test.mjs`. Wire opt-in local API handling into `scripts/serve.mjs` before its static GET/HEAD check.

**Interfaces:** `GET /v1/catalog`, `GET /v1/passage` with validated revision and frame bounds, `POST /v1/preparations` with a recipe, `POST /v1/takes` with `{preparationId, requestId}`, `GET /v1/takes/:id`. Preparation returns an identity, dry/take descriptors and a normalized editable recipe. Reads return retrievable asset URLs; asset identities are stable hashes. Publish returns `{id,parentId}`. Request IDs survive a retry of the same draft revision.

- [ ] Write RED service tests with a temporary store: render, preview, publish, restart the process, retrieve by ID, fork, and compare both original and take hashes to the preview. Exercise concurrent duplicate publication, reuse of one key with different input, and injected failure after storing one asset. Run `node --test test/take-publish.test.mjs`.
- [ ] Derive all assets from allowlisted revision, frame range and supported recipe. Validate limits before decoding or allocating. Write immutable assets first, verify completeness, conditionally create the manifest last. Make the ID stable across same-request retries (including lost replies), detect mismatched reuse, and serve only committed manifests through public take reads. Keep unpublished preparation references scoped to opaque handles. Never accept arbitrary audio or remote source URLs.
- [ ] Derive a single immutable publication key from request ID, and use conditional creation to bind that key to one preparation and resulting take ID. A retry reads and completes the same binding. Implement the filesystem adapter with atomic create/rename semantics and the same conflict rules as the hosted adapter. Test missing/malformed takes, stale preparations, failed reads and successful retry. Add a prepared fixture catalog to the local test server invocation so routine CI works offline. Run the focused tests green and commit.

### S6. Open a link, compare on one playhead and publish a child

**Files:** Create `src/experiences/takes/{TakePage.tsx,ComparePlayer.tsx,api.ts,index.html}`, `e2e/take-handoff.spec.cjs`. Modify `TakeEditor.tsx` in that directory, `webpack.config.js`, `scripts/{routing,check-routes,deploy}.mjs` and `test/labs-routing.test.mjs` as needed for the new static entry. The public test belongs in the default public suite.

**Interfaces:** Public URL `/takes/?id=<opaque-id>`; the static shell reads the ID and calls S5 without a Labs session. `ComparePlayer({original,take})` controls one transport. Wire Labs maker and public editor to the same service client. A prepared preview is tied to the draft revision that requested it.

- [ ] Add RED public and routing tests: two fresh browser contexts with separate storage, a forwarded-link open, A/B during playback, Make a variation, a hit-three → hit-four move and a distinct child link. Reopen parent and child after closing both contexts. Assert manifests, decoded reference audio and timeline event positions. Run `node --test test/labs-routing.test.mjs` and `npm run test:browser:public -- e2e/take-handoff.spec.cjs` against the built site.
- [ ] Add the `takes` Webpack entry/template, dev fallback and CloudFront static page mapping. Include the shell in release route checks and deploy overlap checks. Read the query string client-side. Preserve ROOM styling and avoid loading Labs login, its gallery or a second mix player. Provide loading, unavailable, retry and unsupported-edit-version states. A parent with playable assets should remain listenable if its editor fails.
- [ ] Schedule both decoded reference buffers from one audio-clock offset with common gain and a brief complementary crossfade. Seek into the full prepared buffer so earlier echo history is present. Make a variation starts by playing the parent's exact assets. After edits, prepare again, audition those assets, and share that preparation. Ignore stale preparations and preserve the draft on save failure.
- [ ] Build and rerun both focused suites; include signal checks across seek and A/B, failed publication/retry, and release-prefixed routing. Check `test:browser:public -- --list` and `test:browser:labs -- --list` for suite ownership. Commit.

### S7. Exercise durable publication in hosted preview

**Files:** Create `services/takes/{lambda,s3-store}.mjs`, `infra/takes/template.yaml`, `scripts/check-take-service.mjs`, `test/take-store.test.mjs`. Wire the public API origin into `webpack.config.js` and the existing check/release workflow build environments. Pin service dependencies separately if required. Use the same handler as S5.

**Interfaces:** The store provides `read(key)`, `putIfAbsent(key, bytes)` and `assetUrl(key)`. The hosted adapter issues renewable asset URLs on reads; the human-facing link always contains the stable take ID. A separately configured preview API origin avoids sending API writes through the static-site viewer function.

- [ ] Run identical store-contract tests on a temporary directory and isolated hosted prefix, covering conditional creation and concurrent retries. Make the missing adapter fail first. Configure S3 retention for published manifests, sources, renders and fragments independently of static deployments. Reclaim expired preparations without removing objects referenced by a published take.
- [ ] Package the handler with bounded rendering. Keep binary audio out of the API response envelope using object URLs for fetches, including passage PCM. Set allowed preview/site origins and configure object CORS for browser PCM reads. Bound request bodies, concurrent renders and anonymous request rates. Benchmark 8, 30 and 60 second passages, sparse and maximum-density gestures, cold/warm preparation and memory use. Select the supported duration and gesture caps from the measured mobile and service budgets, expose them through the catalog and editor, and fail early above them. Any position within MX029 must remain selectable.
- [ ] In a preview environment, run `node scripts/check-take-service.mjs` against the configured origin. Verify independent reads after a process restart, lost-response retries, a forwarded link after signed URLs expire, and compatibility across two take-capable static releases. Capture limits, latency, service configuration and public-read results. Run `node --test test/take-store.test.mjs`; commit the adapter, template and checks. Production publication uses ROOM's existing release process separately.

### S8. Accept the Space handoff before starting Memory

**Files:** Extend `e2e/take-handoff.spec.cjs`; record results in `docs/audio-research/space-take-handoff.md`. Reuse the [Space measurements](../../audio-research/space-and-echoes.md) for the existing return-level baseline.

- [ ] Add explicit coverage for public takes at frame zero, across a non-curated segment boundary, and ending at the final MX029 frame. Check decoded length and boundary samples against the canonical master. Check parent/child impulse timing with a signal fixture as well as real-passage replay. Run the new public and Labs specs across configured browsers.
- [ ] Run the repository gates: dependency policy, lint, both typechecks, `npm test`, `npm run build`, route checks against the built HTTP server and `npm run test:browser:public`. Run focused Labs Space/maker checks and record any pre-existing WebKit failures separately from new evidence.
- [ ] On desktop Chromium and physical mobile Safari, open forwarded preview links with clean storage. Play, compare, edit and publish a child on both platforms using actual MX029. Compare the render the maker heard with what arrived. Have two listeners independently identify the changed hit and describe whether its tail masks the next hit on the curated and dense passages. Record device, passage, dry gain, peak, return energy and the listeners' words. Recalibrate and repeat if they cannot find or hear the gesture without coaching.
- [ ] Commit the evidence and mark Space accepted only when content, device and listening checks pass. Keep unavailable hardware or listener evidence explicitly pending. Then open the [Memory implementation plan](./2026-11-19-memory-fragment-handoff.md).
