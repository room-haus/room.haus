# Additional rhythm — Task 03 baseline

19 November 2026. Local implementation on `codex/audio-rhythm`, based on the fetched `origin/master` at `de4d70f`. `git rebase origin/master` reports up to date. The unrelated dirty `codex/underlevel-slice` checkout is preserved. Prepared for a pull request at the user’s request; generated WAVs, screenshots and source caches remain local. No deployment or public-player integration is included.

Open **http://127.0.0.1:4243/labs/#audio-experiments → Additional rhythm**. The existing Labs session gate still applies. Press **Play source**, then **Start rhythm on this downbeat** on a chosen first beat. This one action arms the layer and anchors its clock together. While running, the action becomes **Re-anchor downbeat**; there is no separate silent Arm control. Compare with **Original**; **Stop effects** removes added sound while preserving the mix. Both clear phase, so adding rhythm again requires another anchor.

## Scope and controls

Three generated kit lanes, one 16-step bar, three sparse patterns:

| Pattern | Closed hat steps | Clap steps | Kick |
| --- | --- | --- | --- |
| Air, default | 3, 11 | None | Off |
| Reply | 3, 7, 11, 15 | 13 | Off |
| Punctuation | 11 | 13 | Off |

The optional kick toggles step 1. The disclosure exposes all 16 editable steps for kick, clap and hat; this is a small research surface, with no arrangement, pattern chaining, save system or preset library. Swing is omitted to keep timing and correction inspectable.

Manual BPM accepts 40–240; editing it stops the layer. Tap tempo consumes current source time from the existing session at the gesture, rather than the host's 100ms-old display snapshot. It uses the shared tap helper, then clears phase: tapping never asserts a downbeat. **Start rhythm on this downbeat** commits the displayed tempo and current source time. The status shows actual armed/anchored state, BPM, source anchor in seconds and signed offset. **Earlier / Later 10 ms** shifts phase within ±100ms. There is no estimated tempo input, automatic phase detection or beat-synchronization claim.

Anchor identifies the beat at the gesture; events already elapsed are not replayed. For example, a step-1 kick normally first occurs at the next bar, while Air's first hat is half a beat after the anchor. Nudging cancels queued voices and truncates sounding layer tails through the shared fade; it reschedules canceled future grid positions while preserving deduplication for elapsed positions. Pattern edits change unscheduled hits; already-queued work can remain for up to 100ms unless Original/Stop/anchor cancels it.

Layer level is the shared 0–1 setting, default 0.5. The dry source stays present at the shared fixed 0.5 headroom in both modes. Layer gain is additionally `0.5 * level`; individual tracked voices are kick 0.3, clap 0.4, hat 0.5. A louder result is not evidence of a better groove.

## Ownership, timing and re-arm policy

`ResearchHost → ListeningSession → AudioController → ResearchAudio` still owns the only mix element, AudioContext, output guard, transport, 25ms clock timer, sample admission and teardown. `rhythmLayer` installs one layer module and calls `clock.repeat(0.25, callback)`; each sample is played using `ResearchAudio.playBuffer(buffer, suppliedAudioTime, level)`. No animation-frame scheduling, independent timer, destination connection, player or context exists in this experiment. The module's output node is silent because every kit voice goes through the existing tracked layer bus.

The shared clock change is additive: callback argument three is now the existing integer grid index, relative to the current phase and requested division. Existing `(audioTime, generation)` consumers retain their behavior. The rhythm module selects `index % 16`; it does not calculate another clock. Its pending-position bookkeeping only distinguishes elapsed from canceled future callbacks; it never fires events itself. Actual owner scheduling is bounded to the next 100ms, with at most two pending sixteenth-note grid positions at the maximum tempo.

| Event | Layer / timing state | Return action |
| --- | --- | --- |
| Open, Original, Stop, Reset | Silent; clock generation canceled and phase unset | Play if needed, then Start rhythm on this downbeat |
| Pause, seek, buffering, ended, source error | All queued/active voices stopped; phase unset | Restore playing source, then Start rhythm on this downbeat |
| Source selector or error retry | Existing owner replaces/disposes source; Original | Deliberate play/anchor; selector also restores sparse settings |
| Hidden tab, suspended context or >150ms media/audio progression disagreement | Original; no catch-up scheduling | Restore a playing/running source, then Start rhythm on this downbeat |
| Close | Session disposes graph, timer, listeners, buffers and voices | Reopen starts off; launcher focus restored |

Original/Stop uses the shared 15ms gates and voice stops within 20ms, independently of module cleanup. Pause and native media seek cancellation use that same owner. At most 16 active **plus retiring** voices are admitted across the shared layer. Excess voices are dropped, never queued for later. Re-arm does not replay a backlog.

Native WebKit HLS, missing Web Audio and guard failure preserve audible Original and disable added rhythm with a visible explanation. Selecting a generated diagnostic source is explicit; the chosen mix is never silently substituted. Browser emulation and media-clock progress do not establish physical speaker output.

## Materials, calibration and budget

Reuse `shared/audio/research/materials.ts` and its `materials.manifest.json`: original deterministic MIT-licensed 909-inspired approximations, **not TR-909 recordings**. Only kick, clap and closed hat buffers are retained. For this experiment only, each copied waveform is scaled to 0.9 sample peak before the bounded per-voice and layer gains. There is no change to the shared kit, compression, extra saturation or normalization of the source mix.

Initial uncalibrated sparse hats measured −44.8 to −48.4dB layer/dry RMS across the three MX029 excerpts. That could easily be masked. Attack calibration raises Air's layer by 15.55dB, while retaining sparse placement and a shared level control. The regression checks an actual default hat output peak between 0.04 and 0.1 with the real shared 0.125 layer/headroom multiplier; current peak is 0.05625. This is a signal-level criterion, **not human confirmation of audibility or enhancement**.

Three 24kHz mono buffers retain 104,640 bytes Float32 PCM per active module, generated once per arm, with short bounded retirement through the owner. No sample downloads or dependencies were added. The named lazy JS chunk is approximately 17.1KB / 6.3KB gzip, below the foundation's 40KB gzip ceiling. The evidence report records exact sizes, source hashes and the actual chunk identity. Copied-buffer calibration is recorded in the shared materials manifest's `consumerProcessing` entry.

## Measurements and local examples

[`rhythm-measurements.json`](rhythm-measurements.json) records SHA-256 provenance, settings, source times, peak/RMS, layer/dry ratios and fixed-grid drift. Local WAVs, screenshots and source caches are ignored under `artifacts/audio-rhythm/`.

Each of four sources has Original, Air, Reply and a deliberately competing offset example: `reference-loop-*.wav`, `mx029-006-*.wav`, `mx029-090-*.wav`, `mx029-210-*.wav`. Files are 9s, stereo PCM16 at 24kHz: eight seconds of source plus one second for layer decay. Raw files are unnormalized; they are not LUFS or perceptually matched. Original uses exactly the same dry headroom. The dense/off-grid example is an evidence counterexample, not another launcher preset.

MX029 excerpts reuse the existing hash-verified Task 01 fixtures at approximately **1:00.006–1:08.006**, **15:00.093–15:08.093**, **35:00.218–35:08.218**. Exact URLs, segment hashes and times remain in `scripts/fixtures/audio-processing-passages.json` and the local `passages/source-manifest.json`. MX029 retains its original source rights; no redistribution license is claimed. These excerpts stay local.

| Source / candidate | Measured behavior | Listening observation / alignment status |
| --- | --- | --- |
| Fixed 120 BPM generated loop; Air, 50% level, phase 0 | Eight hats; layer/dry −22.89dB RMS, total RMS +0.062dB | Candidate for light reinforcement. Grid is known, not estimated. **Not human-auditioned.** |
| Same loop; Reply, 50% level | 20 hits; layer/dry −18.63dB, total RMS +0.208dB | More clap/hat emphasis may compete with the fixture's existing kit. **Not human-auditioned.** |
| MX029 35:00 excerpt; Air / Reply, 50% level | Layer/dry −29.25 / −25.30dB; total RMS +0.005 / +0.013dB | Relatively sparse passage candidate based on earlier crest/window evidence. **Manual trial 128 BPM, excerpt-start anchor; not beat-verified or auditioned.** |
| MX029 15:00 excerpt; Air / Reply, 50% level | Layer/dry −32.82 / −28.87dB; total RMS +0.002 / +0.006dB | Denser passage may mask the layer. **Same unverified manual trial**, not a claim of alignment or musical support. |
| Dense 16th hats plus quarter-note kick/clap; +75ms phase, 100% level | Fixture layer/dry −3.39dB and total +1.65dB; MX029 layer/dry −10.64 to −14.21dB; all peaks ≤0.571 | Deliberately intrusive candidate: doubled attacks and a competing pattern. **Not a listening finding.** |

**What sounded complementary or intrusive is not established:** no human listening review was performed. Successful signal checks cannot answer the research question. The examples expose sparse versus dense/off-grid conditions for audition; the arbitrary MX029 trial values must be corrected by a listener before assessing support. Manual anchor precision, headphone/speaker latency, tempo changes and drift within the DJ mix remain unqualified.

### Timing evidence and drift

- At 120 BPM, default hats start at **0.250, 1.250, 2.250, 3.250s**; the generated waveform's first sample above `1e-7` is at **0.250041667s**, one 24kHz sample after scheduled start. Its attack begins at zero by design.
- The 60s fixed-grid test schedules **480 sixteenth-note callbacks** with **0 seconds calculated max grid error and 0 end-minus-start drift** for the exact 120 BPM fixture. This measures audio/media grid arithmetic, not acoustic latency or JS wake-time guarantees.
- A simulated scheduling stall from 0.3–2.0s drops the missed 1.25s hat; it resumes at 2.25s, with no duplicate or backlog burst.
- A +10ms nudge moves future 1.25/2.25s hats to 1.26/2.26s. A nudge just after an elapsed 0.25s hat does not replay it at 0.26s. In the actual guarded owner, three queued voices at +80ms are canceled and replaced at +90ms; Stop cancels the replacements before they sound.
- Dense edits at 240 BPM reach **16 admitted voices**, reject excess voices, and retain finite output. Actual output capture is zero after queued cancellation and after sounding voices settle following Stop. Re-arm without anchor produces **zero hits**; one deliberately anchored kick produces **one hit**.
- **Live DJ mix drift:** not measured against a verified beat grid. The offline MX029 additions use fixed trial tempo, so zero numerical scheduler drift cannot be translated into zero musical drift. For scale, a 1 BPM tempo error around 128 BPM produces about 469ms phase error over 60s; tempo matching alone still leaves unknown phase.

An additional **7-second actual transport** check plays the generated120BPM WAV
through the real ListeningSession/source/context and records seven default hat
starts. It samples the media/audio mapping at native `source.start`, rather than
substituting identical media and audio timestamps. The displayed anchor is rounded
to the nearest0.5ms. Results are in [`rhythm-transport-drift.json`](rhythm-transport-drift.json):

| Browser emulation | Maximum absolute media/grid error | Last-minus-first error over7s |
| --- | --- | --- |
| Chromium desktop | 5.783ms | +5.333ms |
| Android Chromium | 0.368ms | approximately0ms |
| iPhone WebKit, regular generated WAV | 0.377ms | −0.265ms |

These are scheduled-start/media mapping measurements, including clock sampling
and display precision, **not physical output latency or verified DJ beat drift**.
The check requires <40ms absolute error and <20ms last-minus-first error; those
are test bounds, not synchronization promises. All three retained their anchor
and produced exactly seven sparse hits without a stall/backlog.

Automatic assistance is worth researching only as an optional, reversible suggestion: candidate BPM first, then transient/downbeat candidates with explicit uncertainty and manual confirmation. A short passage with listener-corrected anchors should be annotated before comparing assistance with manual tap/anchor. This baseline supplies no evidence that automatic assistance would be accurate or preferred, and it should not silently follow tempo estimates.

## Verification

Final source: **130/130 Node tests**, both TypeScript checks, lint, dependency policy, production build and **99 HTTP routes / 94 assets** passed. **24/24 rhythm browser cases** passed across focused runs on Chromium, Android Chromium emulation and iPhone WebKit emulation, including real rendered samples, the real guarded owner, native fallback, reset/retry/source replacement, visibility, buffering, seek, pause, close/reopen, failed lazy chunks, keyboard steps, reduced motion, 44px targets, 390/768/1440 layouts, true 200% text and actual7s transport drift.

Existing audio foundation, processing and space regression matrix: **70 passed / 5 intentional platform skips / 0 failed** on all three browser projects. It ran after the shared callback/host additions. A later unsupported-path copy correction removes the inherited matched-headroom claim when no research graph is available; the final rhythm and foundation delta matrix passed38 with4 intentional skips, followed by3/3 new transport-drift cases. The full426-case site suite was not run. Inventory is **174 public + 252 Labs = 426**, zero overlap or omissions; rhythm's24 cases are deliberately internal and do not expand automatic public browser CI.

Independent read-only review identified the queued-hit nudge dropout. Its real-owner regression failed with zero replacement hits, then passed with three replacements shifted exactly +10ms. The fix distinguishes elapsed from canceled future positions. The attack-calibration regression also failed before the gain change and passed after it. The reviewer reported no other actionable code finding; this does not establish musical acceptance.

Screenshots: `controls-<project>-<width>.png` show the expanded editor and `controls-<project>-200.png` shows enlarged text. `host-<project>-<width>.png` captures the beginning of the actual live-source host. Diagnostics, actual live-source capability/cleanup and source manifests are stored separately from deterministic media fixtures. Reproduced browser results qualify only those tested paths, not physical devices or arbitrary HLS/CORS sources.

Actual MX029 HLS probes (`live-<project>.json`) confirmed running layering with
one media element / one context on Chromium and Android emulation. Native mobile
WebKit kept Original playing with zero contexts and unavailable layer controls.
All three closed with media paused/src removed, every created context closed and
zero page errors. Live anchors were deliberate automated gesture trials at120BPM,
not listener-selected downbeats or evidence of alignment. Expanded editor and
top-of-host captures were visually inspected at desktop/390px/200% sizes.

Reproduce locally (pipe command output through `compress` per global instructions):

```sh
npm run build
PORT=4243 node scripts/serve.mjs
# In another terminal:
ROOM_TEST_ORIGIN=http://127.0.0.1:4243 npm run test:browser:labs -- e2e/audio-rhythm.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4243 node scripts/audio-rhythm-evidence.mjs
ROOM_TEST_ORIGIN=http://127.0.0.1:4243 node scripts/audio-rhythm-preview.mjs
```

The render script uses the real module and shared clock in offline Web Audio with an explicit adapter for the shared gain equation; it is not a test of real-owner voice admission. The browser's real ResearchAudio test separately owns guard, cancellation and admission evidence. Hash-verified MX029 extraction needs ffmpeg and network access or matching local caches. No audio is uploaded.

## Follow-up: silent arming trap

The user reported no drums. Their active in-app browser showed Arm rhythm selected and a running MX029 source at 139.2 BPM / 100% layer level, but phase was unset ("Anchor required · rhythm silent"). Pressing the old Anchor action changed the actual session to Mix + rhythm. The separate arming button made a silent state look enabled.

The rhythm host now hides generic arming and offers one primary **Start rhythm on this downbeat** action, which invokes the existing arm/tempo/anchor/subscription path. Once running it reads **Re-anchor downbeat**. Tempo taps and interruptions still stop the layer and require deliberate restart. This changes no voice gain, DSP, timing horizon or transport ownership. A browser regression catches the old silent control and verifies a single start click results in admitted sample voices. The audible result still needs user confirmation; UI state is not an acoustic listening test.

Follow-up validation: all24 rhythm browser cases passed on Chromium, Android and mobile WebKit; default shared comparison/fallback regressions passed5 with1 intentional native skip. All130 Node tests, experience typecheck, lint, production build and99routes/94assets passed. The user’s current source position,139.2BPM, layer level and custom steps were restored after refreshing the existing tab; actual in-app diagnostics showed one scheduled subscription, anchored playback and five active voices.
