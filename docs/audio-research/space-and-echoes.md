# Space & echoes — Task 02 baseline

18 November 2026. The `audio-space` launcher supplies filtered delay or compact convolution reverb through the existing ROOM Labs research owner. Based on master `972166a`; proposed in [PR #54](https://github.com/room-haus/room.haus/pull/54). No public-player integration or deployment. Generated audio, screenshots and source caches stay local.

Open `http://127.0.0.1:4232/labs/#audio-experiments`, then **Open Space & echoes**. Choose a source, press **Play source**, then **Processed**. Delay/Reverb chooses the effect; changing that choice alone does not enable processing. Original is always the reference. The explicitly selected generated reference lasts eight seconds; replay and re-arm deliberately after it ends.

## Calibration and listening status

**Human observation:** the user reported that neither effect could be heard in the initial playground build. Inspection of their active tab confirmed processing support and successful module arming. Subtracting matched Original from Processed exposed underpowered returns: on the generated diagnostic loop in mono at 50% effect level, delay RMS was 0.03075 of dry (−30.24dB) and reverb was 0.02044 (−33.79dB). Earlier checks proved the return existed but did not check its strength against the source.

The revised fixed calibration retains more drum/body energy and increases return strength without changing dry gain. On the same material/settings, delay is now 0.13708 of dry (−17.26dB), reverb 0.13130 (−17.64dB): about +13dB / +16dB in the **return**, not in the dry source or total output. At full effect level those ratios double. This is a numerical calibration improvement, **not an audibility or musical-enhancement guarantee**. The new browser regression requires return/dry RMS ≥0.1 at 50% level and ≥0.2 at full level, finite output and peak <0.95 on the real shared reference material. It failed before the fix and passes after it.

The rebuilt experiment was reopened and armed successfully in the user's existing in-app browser with the generated reference. The new screenshot is `artifacts/audio-space/controls-calibrated-iab.jpg`. Human acceptance of the revised sound and preference for sparse/dense passages remain open. No physical speaker/headphone qualification is claimed.

## Controls, ownership and bounds

| Control | Delay | Reverb |
| --- | --- | --- |
| Time / space | 40–400ms free time, or deliberate manual 1/16, 1/8, 1/4 divisions | 5–45ms pre-delay |
| Feedback / decay | 0–48% filtered feedback | Convex blend of close (0.18s) and air (0.9s) responses; not a continuously simulated physical RT60 |
| Effect level | Shared 0–1 control, default 0.5; dry remains unity | Same |
| Restrained stereo | ≤35% side width; right echo offset 8ms | ≤35% side width from decorrelated responses |

Delay repeats pass non-resonant 80Hz–6.5kHz filters; the forward return is `0.85*(1-feedbackGain)`, so increasing feedback does not increase the total steady repeat transfer above 0.85 for a unit-magnitude filter. Reverb input is filtered to 80Hz–7kHz with return gain 0.9. All setting/mode changes use the shared 40ms ramp helper. Moving delay time can bend echo pitch; this is not time stretching. Both networks stay warm while the processor is armed.

The existing ResearchHost → ListeningSession → AudioController → ResearchAudio path owns source, context, guard, transport cancellation, capture and clock. Every module node uses `scope.own`. No shared implementation changed, and there is no direct connection to destination. The insert returns `dry + return`; the shared crossfade produces `(1-L)*dry + L*(dry+return) = dry + L*return`. These are weighted insert/bypass branches, not duplicate full-gain dry paths. The existing fixed 0.5 headroom and independent 0.98 output guard remain unchanged.

Original/Stop remove both networks through shared gates, then retire the scoped graph; re-arm creates clean state. Reset restores visible defaults without seeking. Pause/seek/error/buffering/source replacement/visibility loss return to Original and require deliberate re-arm. Close disposes the session. The named lazy loader retains failed-download retry. There is no renderer, room model, transport, independent context or scheduling owner.

Manual divisions call `research.clock.setTempo` and use `60/bpm*division` (40–240BPM; maximum interval 1.5s). Until tempo is set, free time is retained with explicit guidance. These are delay intervals, not phase-aligned scheduled beats. No automatic estimate is read or trusted; any future scheduled gesture must deliberately establish shared media phase and use the shared horizon.

## IR provenance and budget

`src/experiences/audio-space/impulses.manifest.json` records two original synthetic stereo noise responses under the repository MIT license: deterministic LCG seeds 773/1770, `exp(-9.21034*t/duration)`, final 2% taper, per-channel L2 energy 0.8, convolver normalization disabled. They have no direct impulse and do not claim realistic rooms or authentic hardware. Durations are 0.18s / 0.9s. Local PCM16/24kHz exports: `ir-0.18.wav`, `ir-0.9.wav` in `artifacts/audio-space/`.

Two fixed buffers are generated once per arm at the shared context's rate: ~415KB Float32 at 48kHz / ~829KB at 96kHz. Two fixed 1.6s delay allocations plus one 0.1s pre-delay bound delay storage. No slider-triggered buffer regeneration or IR downloads. Final lazy bundle size and source hashes are recorded in `space-measurements.json`; it remains below the shared 40KB gzip ceiling. No dependencies added.

## Render measurements and comparison material

Actual insert offline renders use the shared balance equation and fixed 0.5 headroom, at 24kHz stereo. The offline graph omits the guard; all regenerated source/mode peaks remain below 0.561, so it is not used to create the effect. The actual guarded real-time path is independently exercised by the browser suite.

An impulse at 0.100s retains dry amplitude exactly 1 on both channels; 200ms delay first arrives at 0.300s, and 21ms reverb pre-delay begins at 0.121s. Zero feedback produces no second repeat; max feedback / longest manual interval remain finite, with 16–18s windows below 0.0001 peak. Mono return is equal L/R for mono input; restrained stereo introduces a bounded L/R difference. The actual shared path preserves 0.2-peak sine Original RMS ≈0.07071, zero-level insert and bypass. Both sounding delay/reverb tails are removed by Original and Stop: after the intended ~15ms fade, captured output after 40ms is zero and active modules are zero. Capture's 100ms minimum is explicitly accounted for. This is signal/audio-time evidence, not physical output latency.

Four sources have Original, Delay, Reverb, Long echo and Air heavy versions: the shared generated 120BPM loop plus MX029 segments 006, 090, 210 (~1:00.006, 15:00.093, 35:00.218). Each WAV is 8s of source plus 2s tail, stereo PCM16/24kHz. The existing Task 01 fixture and SHA-256 cache helper verify the MX029 excerpts; exact URLs, hashes and times are in `artifacts/audio-space/passages/source-manifest.json`. The generated loop follows the shared MIT materials manifest; MX029 retains its catalog/source rights, with no redistribution license claimed.

Raw `*-original.wav`, `*-delay.wav`, `*-reverb.wav`, `*-long-echo.wav`, `*-air-heavy.wav` are unnormalized. `*-comparison-*.wav` only attenuate each version to the lowest body RMS in its passage group; they never boost and do not claim LUFS/perceptual matching. Initial loop examples and measurements are retained locally under `pre-calibration/` for comparison. The evidence script now records **return RMS / dry RMS**, as well as total peak/RMS, so a dry-dominated output meter cannot stand in for effect strength.

| Passage / setting | Current measured result | Listening hypothesis / status |
| --- | --- | --- |
| Generated loop; 200ms, 16.8% feedback, 50% level, restrained stereo | Return/dry −16.81dB delay / −16.84dB reverb; 72.5% of original 50ms windows below half body RMS | Sparse gaps should expose echoes/air. Initial build was reported inaudible; revised subjective result awaits user confirmation. |
| MX029 35:00.218–35:08.218; same settings | Original crest 15.35dB, 8.75% quiet windows; return/dry −14.37dB delay / −13.51dB reverb | Relatively sparse mix candidate for added depth. Listen for competing attacks. Revised audio not human-reviewed. |
| MX029 15:00.093–15:08.093; same settings | Original crest 11.87dB, 3.75% quiet windows; return/dry −16.18dB delay / −15.94dB reverb | Denser mids may mask the return or be masked by it. Revised audio not human-reviewed. |
| MX029 1:00.006–1:08.006; 400ms, max feedback/level | No quiet windows by the stated threshold; long-echo tail RMS 0.01645 versus default delay 0.00855 | Counterexample for rhythmic smear; the numerical tail increase does not establish musical harm. Not human-reviewed. |
| Full air / 45ms pre-delay / 100% level on all mix excerpts | Body RMS shifts +0.58 to +1.10dB, peaks ≤0.561; tails substantially exceed restrained settings | Test whether distance becomes wash or masks detail. Compare Original repeatedly. Not human-reviewed. |

Sparse/dense classifications use crest/window occupancy, not stem counts or subjective arrangement judgment. A larger return is not proof of a better mix.

## Browser evidence and validation

Calibrated source: **128/128 Node**, experiment TypeScript check, lint, production build and **99 routes / 94 assets** passed. **20/20 Chromium + Android** experiment cases passed, including source lifecycle/failure/retry, bypass, reset, close, keyboard, reduced motion, 390/768/1440 and true 200% text. **3/3 mobile-WebKit signal cases** passed: return-level calibration, impulse/bounds/mono-stereo, and actual guarded dry/tail-removal. Independent read-only review found no actionable calibration issue. Before this DSP follow-up, both TypeScript checks, dependency policy and zero-vulnerability audit had passed; there are no dependency or Underlevel changes.

The explicit internal suite boundary remains disjoint: **174 public + 228 Labs = 402** cases, zero overlap/omissions, with 30 cases in this experiment's spec. The complete 402-case matrix was not run. These Labs checks do not expand normal public E2E CI.

Chromium/Android processable media fixtures are deterministic WAVs attached through the real source owner; they are not live-CDN evidence. Prior `live-*.json/png` probes separately recorded actual MX029 HLS output and cleanup: Chromium/Android processed with nonzero output; native WebKit HLS preserved Original without creating a context and disabled processing. Missing Web Audio / failed guard preserve Original. Explicit generated regular WAV is processable in the in-app WebKit browser. Emulation and a software signal graph do not qualify physical devices, arbitrary CORS sources or acoustic listening.

**Shared WebKit UI dependency remains open:** a prior final UI run timed out on launcher/control input. The same pointer interception reproduced against the pre-space Task 01 build `4c1a92d` on Open Tone & texture. Keyboard opened the host but did not qualify the whole flow. Exact earlier failures were `space controls share transport, manual clock, reset and close lifecycle`, `layout, keyboard and reduced motion at 390/768/1440 and enlarged text`, and `keyboard launcher and explicit generated source process through the host on every browser`; the chunk-retry case was interrupted. Preserved logs are under `artifacts/audio-space/`. No green full WebKit UI matrix is claimed. The current user's in-app generated-source flow was separately reopened/armed after this fix; that does not erase the earlier dependency.

Reproduce locally (pipe shell output through compress per global instructions):

```sh
npm run build
PORT=4232 node scripts/serve.mjs
# another terminal
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 npm run test:browser:labs -- e2e/audio-space.spec.cjs --project=chromium --project=android --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 npm run test:browser:labs -- e2e/audio-space.spec.cjs --project=mobile-webkit --grep 'default delay and reverb returns|real insert|shared guarded' --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 node scripts/audio-space-evidence.mjs
ROOM_TEST_ORIGIN=http://127.0.0.1:4232 node scripts/audio-space-preview.mjs
```

Regeneration requires existing Playwright browsers and ffmpeg for verified MX029 extraction. Generated material/IRs need no downloads or ffmpeg. Raw audio/screenshots/cache stay ignored and local.

## Later gesture mappings

Small horizontal drag → free time / pre-delay; vertical drag → return level; release → ramp back toward a restrained setting. Pressure/hold could raise feedback within its fixed 48% cap, with Original/Stop always available. Discrete gestures could choose mono/restrained width or close/air. Tempo tap and media-phase anchor remain deliberate shared-clock actions before scheduling any voice. Require listening evidence before coupling this baseline to an interactive.
