# Space & echoes — Task 02 baseline

18 November 2026. Labs implementation on `codex/audio-space`, based on fetched master `972166a` (including completed Tasks 00 and 01). The original dirty checkout was preserved. Source, tests and research notes are prepared for a pull request at the user's request; generated audio, screenshots and source caches remain local. No deployment or public-player integration.

Open `http://127.0.0.1:4232/labs/#audio-experiments`, then **Open Space & echoes** (`audio-space`). This uses the existing Labs gate. The original MX029 mix is selected initially; playback and effects require explicit actions. Generated sources are an explicit selector choice.

## Controls and routing

The existing ResearchHost, ListeningSession, AudioController and ResearchAudio own playback, AudioContext, guard, transport cancellation, clock and cleanup. No shared implementation changed. The registry has one named lazy `audio-space` loader; closing/reopening retries failed downloads. Interface preserves ROOM typography, square controls, palette, focus and 44px targets; no renderer or spatial world.

| Control | Delay | Reverb |
| --- | --- | --- |
| Time / space | 40–400ms free time, or manual 1/16, 1/8, 1/4 divisions | 5–45ms pre-delay: separation before the response |
| Feedback / decay | 0–48% filtered feedback | Linear blend between close (0.18s) and air (0.9s) responses; this is a blend, not continuously adjustable physical RT60 |
| Effect level | Shared 0–1 control, default 0.5 | Same |
| Restrained stereo | At most 35% side width, including an 8ms R-channel echo offset | At most 35% side width from decorrelated generated responses |

Delay is band-limited to 180Hz–3.8kHz on every repeat, without resonant boost. Reverb input is filtered to 220Hz–4.8kHz. Return gains are 0.32 and 0.55 respectively. Parameter changes use the shared ramp helper over 40ms; mode changes crossfade returns. Both bounded networks remain warm while Processed is armed. Changing delay time can bend echo pitch during the ramp; it is a baseline, not a seamless time-stretch delay.

The insert returns `dry + wet return`; the shared linear crossfade produces `(1-L)*dry + L*(dry+return) = dry + L*return`. Thus the reference dry amplitude is unity at every effect level, before the shared fixed 0.5 headroom. This uses two weighted insert/bypass branches, **not two full-gain dry outputs**. Wet level 0 is a neutral insert. There is no connection from this module to destination. Existing shared guard remains independent of the processor.

Original, Stop effects, Reset effect, pause, seeking, source errors/replacement, visibility loss and close retain the shared lifecycle. Original and Stop gate off both return networks and retire every node; rearming creates clean delay/IR state. Pause/seek do not silently rearm. Reset also restores the visible mode, free time, mono, feedback and level defaults without seeking. Manual tempo remains a property of the shared clock, as in the foundation.

Manual divisions require **Set tempo**, which calls `research.clock.setTempo`; no automatic estimate is read. Durations are `60 / clock.bpm * division`, up to 1.5s at 40 BPM/quarter notes. Until set, the free-time value is retained and the interface asks for tempo. These are delay intervals, not scheduled/phase-aligned events. No beat-grid claim or phase anchor is implied; a future gesture that schedules additions must deliberately establish shared media phase and use the shared horizon. No additional timers or scheduling owner.

## Impulse provenance and budget

`src/experiences/audio-space/impulses.manifest.json` documents two original generated stereo noise responses. They use deterministic LCG seeds 773/1770, a four-decade exponential amplitude envelope, final 2% taper and per-channel L2 energy 0.45; convolver normalization is disabled. They are synthetic close/air textures, not recordings or realistic rooms. Same MIT license as this repository. Local 24kHz stereo PCM16 exports: `artifacts/audio-space/ir-0.18.wav`, `ir-0.9.wav`.

The final named lazy JS chunk is 17,487 bytes / 6,165 bytes gzip (under the shared 40KB gzip ceiling; shared runtime code is additional). Two fixed buffers are generated only on arm at the existing context's rate, total ~415KB Float32 at 48kHz (~829KB at 96kHz), and released on retirement. No per-slider IR regeneration, network IR requests, dependencies or retained capture rings in the product UI. The only delay buffers have fixed maximum durations (two 1.6s nodes and one 0.1s pre-delay). Decay is finite; maximum feedback is 0.48, without nonlinear makeup gain.

## Measurements and comparison material

Fresh numerical evidence is in `space-measurements.json` and ignored `artifacts/audio-space/`. These are signal measurements, **not evidence of perceived enhancement**. No human listening review was performed. Headless playback progress and a nonzero meter do not establish speaker playback, intimacy, groove or preference.

The actual insert was rendered in OfflineAudioContext at 24kHz, stereo, with an impulse at 0.100s, both mono and stereo inputs, feedback endpoints and the longest manual delay. Tests run in Chromium, Android Chromium emulation and mobile WebKit. Dry impulse = 1.000000 on both channels; a 200ms delay first arrives at 0.300000s. With zero feedback the second echo is zero; maximum feedback's second echo peak is ~0.012885 after filtering. Reverb with 21ms pre-delay begins at 0.121s. Mono return yields identical output channels for a mono input; restrained stereo yields nonzero L/R difference without altering the source dry channels. All samples finite; 16–18s final windows below 0.0001 peak even at maximum timing/feedback. Reverb responses finish within their fixed length plus pre-delay/filter settling.

The **real guarded ResearchAudio path**, separately exercised with a 0.2-peak sine, measures Original RMS about 0.07071 (one dry path at fixed 0.5 gain), with zero-level insert and bypass matching. Both delay and reverb were sounding after a source burst ended, before Original and Stop were exercised. Last sample over 0.000001 occurs about 15ms after capture begins at bypass; after 40ms the captured output is zero, active modules = 0, and closing the context succeeds. The test explicitly excludes the intended fade and accounts for the shared capture's 100ms minimum window. This is browser audio-time evidence, not a physical output-latency measurement.

Comparison WAVs are 10s (8s passage plus 2s tail), stereo PCM16/24kHz. Shared generated 120BPM loop plus verified MX029 segments 006, 090, 210 use the existing Task 01 fixture URLs/SHA-256 and cache helper. Files never leave this machine. MX029 retains its existing catalog/source rights; no redistribution license is claimed. The shared generated loop is MIT, from the shared kit manifest. See `artifacts/audio-space/passages/source-manifest.json` for exact source URL, segment hash and media time (~1:00.006, 15:00.093, 35:00.218).

For each source: `*-original.wav`, `*-delay.wav`, `*-reverb.wav`, `*-long-echo.wav`, `*-air-heavy.wav`. Raw renders preserve the same fixed headroom without normalization; all measured peaks are below 0.532. Offline renders use the real insert plus the shared balance/headroom equation; they omit the guard, whose actual path is tested separately. `*-comparison-*.wav` attenuate each version to the lowest body RMS in its passage group, never boost; this is an audition aid, not LUFS/perceptual matching. See raw and comparison filenames in `artifacts/audio-space/`.

| Material / settings | Measured comparison | Audible hypothesis to check; listening status |
| --- | --- | --- |
| Shared diagnostic loop; 200ms, feedback 16.8%, level 50% | 72.5% of 50ms windows below half its body RMS; dry crest 19.82dB; body RMS change +0.004dB | Sparse gaps expose repeat spacing. Likely useful for rhythmic space; listen for collision with the next kit hit. **Not auditioned.** |
| MX029 35:00.218–35:08.218 (segment 210); same delay | Relatively sparse of these mix excerpts: crest 15.35dB; 8.75% quiet windows; body +0.015dB; post-cut tail RMS 0.00184 | Candidate for subtle depth while keeping the front of transients. Existing recorded ambience may already suffice. **Not auditioned.** |
| MX029 15:00.093–15:08.093 (segment 090); compact blend, level 50% | Denser: body RMS 0.12745, crest 11.87dB; 3.75% quiet windows; reverb body −0.008dB, tail RMS 0.000606 | The recording already fills gaps. Listen for masking in sustained mids and loss of transient separation. **Not auditioned.** |
| MX029 1:00.006–1:08.006 (segment 006); 400ms, max feedback/level | No quiet windows by this threshold; tail RMS 0.01034 versus default delay 0.003465 (~3×) | Counterexample setting intended to reveal smeared attacks / displaced rhythm. Added tail energy does not prove musical harm. **Not auditioned.** |
| All three mix excerpts; full air, 45ms pre-delay, level 100% | Post-cut reverb tails ~3.3–3.9× default tail RMS, body shifts at most +0.140dB | Test whether distance becomes wash and masks detail; compare Original repeatedly. More return is not automatically better. **Not auditioned.** |

Sparse/dense labels here refer to measured crest/window occupancy, not stem count or a subjective arrangement analysis. The synthetic loop is clearly sparser than any mix passage. Human acceptance remains open: audition matched examples on headphones and mono speakers, record whether distance/intimacy and groove improve, and reduce return if repeat energy competes with attacks. Automated success does not close that research question.

## Browser/source evidence and verification

- Chromium + Android Chromium emulation: actual offline graph, guarded real-time output, and processable media-element fixture exercised. The selected HLS URL is replaced with deterministic WAV only in fixture-based tests; that is not live-CDN evidence.
- Mobile WebKit emulation: actual offline and real-time graph exercised; native HLS stays Original with effects disabled, preserving the existing source. Explicit regular generated WAV can use the processable path. No physical-device qualification.
- Missing Web Audio and failed guard: source progresses, processing controls disabled, Original retained. No silent reference substitution.
- Actual MX029 CDN probe and screenshots: `artifacts/audio-space/live-*.json/png`, kept distinct from fixtures. Each report identifies capability, source progress, nonzero meter when available, errors and disposal; a network failure is not a processing success.
- Controls and lifecycle: Original/Stop, Reset defaults, pause/resume, seek, error/retry, source replacement, close/reopen/focus return, failed named-chunk retry, 390/768/1440, real 200% root text, keyboard Space and reduced motion. No shared routing changes, so no new public-player regression requirement.

Control screenshot: `artifacts/audio-space/controls-active.png` (live source with processing controls). Responsive fixture screenshots: `controls-<project>-<width>.png`; native unsupported state remains explicit.

Reproduce from this checkout:

```sh
npm run build
PORT=4232 node scripts/serve.mjs
# another terminal; pipe output through compress per global instructions
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 npm run test:browser:labs -- e2e/audio-space.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 node scripts/audio-space-evidence.mjs
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 node scripts/audio-space-preview.mjs
```

Regeneration requires existing Playwright browsers and ffmpeg for the provenance-verified local MX029 extracts. Generated IRs/reference sources need neither downloads nor ffmpeg. New browser cases are explicitly internal in `playwright.suites.cjs`.

## Later gesture mappings

Small horizontal drag → free-time delay or pre-delay; vertical drag → return level; release → ramp back toward a restrained value. Pressure/hold → bounded feedback (never above 48%) with immediate Original/Stop still available. A discrete gesture could choose mono / restrained width or close / air. Tempo-tap and phase anchor should remain explicit shared-clock actions before scheduling any rhythmic voice. Avoid mapping every movement to sound; compare against the unchanged dry mix and require human evidence before coupling this to an interactive.

## Final validation record and open dependencies

Node suite **128/128**, both TypeScript checks, lint, dependency policy, npm audit (zero vulnerabilities), production build, **99 HTTP routes / 94 assets**, and whitespace check passed. Final inventory is **174 public + 225 Labs = 399** browser cases, zero overlap/omissions; these 27 new cases are internal. The whole 399-case matrix was not run.

Final rebuilt experiment: **18/18 Chromium + Android cases passed**. Earlier focused all-browser runs passed the 18 initial cases and then six guarded-output/generated-source cases. The final combined run passed 19, timed out on two WebKit UI cases, and was interrupted after repeated launcher failures (one interrupted, five not run). A fresh isolated WebKit pointer retry reproduced the failure. This is **not a green final WebKit UI matrix**.

The current WebKit launcher failure occurs before the module loads: Playwright reports `<html>` intercepting the Open button although DOM hit testing finds the button. Explicit centering, paint waits and a real coordinate click did not resolve it. Crucially, it also reproduces against the separate **pre-space Task 01 build at 4c1a92d**, on **Open Tone & texture**, with Space & echoes absent. This is recorded as a shared Labs / WebKit runtime input dependency, not fixed by adding another host or changing the shared modal. Native keyboard focus + Enter opens Space & echoes in the same failing environment. See ignored `debug-launcher.json`, `debug-baseline.json`, the keyboard probe, and retained final/isolated run logs under `artifacts/audio-space/`. Earlier native-CDN playback success remains separate historical evidence from this later input failure. Physical Safari/device behavior has not been established.

The final steady-state dry-gain test discards 100ms after guard attachment; the first WebKit capture in an earlier run included a startup transient. This correction changes measurement setup, not production routing. The manual division selector's `.5`/`.25` option spelling was also caught by visual QA: React serialized numeric values as `0.5`/`0.25`, so the label incorrectly showed Free time. A rendered selection regression failed red with value 0, then passed on Chromium/Android after canonicalizing values. The final active screenshot correctly shows 1/8, 120BPM, 250ms.

Independent read-only source/UI review found no remaining actionable experiment issue after that fix; the final WebKit dependency was investigated subsequently. **Human audition remains open**; no audible quality or enhancement acceptance is claimed. The report supplies comparisons and specific hypotheses so that remaining listening work is concrete.

Final isolated WebKit follow-up: **2 passed / 1 failed**. Offline impulse/bounds/mono-stereo and actual guarded dry/tail-removal tests passed on the final source. Keyboard activation opens the host, but the subsequent generated-source UI flow still times out in the affected runtime. Keyboard opening alone is therefore not claimed as a complete workaround. Chromium/Android remain the qualified local UI combinations; WebKit UI acceptance is blocked by the reproduced shared input dependency. `webkit-signal-final.log` records this result.

The final keyboard/generated-source case also passed again on Chromium and Android (2/2). Exact unresolved WebKit case names in `e2e/audio-space.spec.cjs`: `space controls share transport, manual clock, reset and close lifecycle`, `layout, keyboard and reduced motion at 390/768/1440 and enlarged text`, and `keyboard launcher and explicit generated source process through the host on every browser`. The combined run's `failed space chunk retries on reopening` case was interrupted, not counted as passed or failed. Master was rechecked at delivery and still points to 972166a.
