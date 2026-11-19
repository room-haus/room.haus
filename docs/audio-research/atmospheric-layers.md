# Atmospheric layers baseline

19 November 2026. Local Task 04 on `codex/audio-atmosphere`, based on current `origin/master` (`c201813`). Primary checkout's unrelated dirty work is preserved. The initial delivery was local; the user subsequently authorized commit, push and a PR against master. No deployment.

## Use

Open `/labs/#audio-experiments` → **Atmospheric layers** (`audio-atmosphere`). Play the selected source, choose a setting, then **Start layer**. Layers begin off. Original and Stop effects remove the addition while the mix keeps playing. Pause stops both. Reset restores Veil and clears the effect without seeking; source replacement starts bypassed. Manual tuning is your choice for each passage.

Local preview: `http://127.0.0.1:4257/labs/#audio-experiments`.

| Setting | Texture / brightness / movement / tuning | Layer level | Intended comparison |
| --- | --- | --- | --- |
| Veil | Noise only / 900 Hz / 0.20 / tuning inactive | 0.50 | Low unpitched air; compare the setting against lost percussion detail. |
| Warm floor | Sine only / brightness and movement affect noise only / 110 Hz | 0.50 | One held tone; tune by ear or deliberately leave a clash. 110 Hz is a starting point, not a detected note. |
| Suspended | 35% tone / 2200 Hz / 0.45 / 220 Hz | 0.50 | Noise/tone blend. Reduce level first if it covers detail. |

Brightness and movement operate on the noisy material. Texture changes its balance with the sine; manual tuning is disabled for pure noise. Initial settings apply behind a silent envelope, then the layer fades in over 2 seconds. Live edits use the shared ramp helper over 0.75 seconds. Stop/Original use the existing independent 15ms output gates; rapid safety cancellation takes priority over a slow release. There is no reverb or feedback tail.

## Integration, materials and bounds

The named lazy loader and existing modal retain failed-download/reopen retry. `ResearchHost` owns the existing ListeningSession → AudioController → HLSAudioSource graph, transport, layer bus, metering, guard, capture and lifecycle. This module adds no media element, context, owner, timer, capture ring or event scheduler. Sustained oscillators and a looping noise buffer use AudioContext time directly, with no beat/grid synchronization requirement. No shared interface changed.

One active module owns 9 nodes and exactly 3 sources: looping noise, audible sine and a control-only filter LFO. The shared `diagnostics().voices` counts tracked one-shots, **not these module-owned sustained sources**. Their fixed limit is separately checked in the actual graph. Repeated Start while armed adds nothing. The shared owner permits at most four retired modules alongside an active module during rapid cancellation/re-arm; this bounds the temporary total at 15 sources and five 768KB noise buffers. Retirement disconnects after 25ms; disposal stops all three sources and releases the buffer. No voice spawns periodically.

Noise reuses `makeReference('noise')` and `toBuffer` from the completed foundation: deterministic seed 909, 8-second mono 24kHz buffer, ±0.25 with 10ms endpoint tapers (768,000 Float32 bytes). The loop joins at silence; there can be a tiny recurring dip, not a field-recording claim. It passes through an 80Hz high-pass and a 150–5000Hz low-pass, Q 0.5. Movement is 0–600 cents of filter detune at 0.03–0.12Hz. Sine tuning is manually bounded to 55–880Hz. Generated material is original under the repository MIT license. Full parameters: `src/experiences/audio-atmosphere/materials.manifest.json`. No new licensed samples or dependencies. The shared 909-inspired kit appears in diagnostic reference comparisons, not in an additional rhythm layer.

For texture t, noise amplitude is `0.5*(1-t)` and sine amplitude is `0.045*t`. The unchanged shared layer multiplier is `level*0.5`, then fixed `0.5` output headroom. Dry source gain stays unity before that headroom. Both added materials are mono/centered. No ducking, automatic key detection, harmonic matching, stem-aware masking or generative composition is implemented.

## Short comparisons and research findings

Generated files are local and ignored under `artifacts/audio-atmosphere/`. `scripts/audio-atmosphere-evidence.mjs` reuses the verified passage downloader, original segment URLs, SHA-256 hashes and FFmpeg decoding from the prior processing baseline. It exports 8-second stereo PCM16 files at 24kHz, unnormalized, plus `*-comparison-*.wav` copies attenuated to the lowest whole-clip RMS within each passage. RMS alignment is not perceptual/LUFS matching. Offline renders use the actual layer module and shared-equivalent gains; they omit the worklet guard and verify every peak below its ceiling. Actual guarded owner output is tested separately.

| Source and comparison | Measurement | Listening observation / conclusion |
| --- | --- | --- |
| Shared 120BPM 909-inspired loop: Original / Veil / manual 110Hz | Veil layer −22.17dB relative to dry RMS; total RMS +0.019dB. Manual tone layer −20.47dB; +0.050dB total. | Not auditioned by a human. Suitable for comparing low noise against percussion masking; no improved groove or setting claim. |
| Known generated 440Hz source: Original / tuned 440Hz / untuned 466.16Hz / Veil | Manual 440Hz unison and one-semitone-up counterexample have equal layer RMS (−29.30dB relative to source). Total RMS +0.281dB tuned vs +0.005dB untuned, due to coherent addition. | Tuning is deliberately specified against a known fixture. Untuned is a dissonance candidate, not a listening-confirmed clash. No key analysis. Use attenuated comparison copies to avoid preferring the coherent loudness increase. |
| MX029 01:00.006–01:08.006, 15:00.093–15:08.093, 35:00.218–35:08.218: Original / Veil / manual 110Hz | Default Veil layer −32.62 to −29.05dB relative to dry; manual tone −30.91 to −27.34dB. Total RMS change below 0.006dB for these defaults. | Not auditioned. Low measured additions may be subtle in dense passages; audibility, emotional change and intelligibility remain unreviewed. These are manually selected tuning candidates, not tuned musical passages. |
| Same mix passages: deliberately bright blend, 5000Hz, full movement and level | Layer −23.37 to −19.80dB relative to dry. Highest peak across all raw references 0.5071; no guard clipping required. | Counterexample candidate for masking hats or occupying tonal space. Masking is a subjective judgment; measurements do not establish that it happened. |

Reference pairs: `reference-loop-comparison-original.wav` / `reference-loop-comparison-veil.wav`; `reference-tone-comparison-tuned-440.wav` / `reference-tone-comparison-untuned-466.wav`; `mx029-006-comparison-original.wav` / `mx029-006-comparison-manual-110.wav`. Also compare `mx029-090-comparison-bright-blend.wav` with its Original. Complete per-render peaks, RMS, settings, source hashes and output hashes: [atmosphere-measurements.json](atmosphere-measurements.json).

**Research acceptance remains open:** no human or acoustic listening review was performed. It is not established whether the added sound improves the setting or simply masks musical detail. For a short follow-up, audition each 8-second Original/comparison pair at a fixed comfortable volume, record atmosphere/audibility/detail judgments, tune a musical passage by ear and record the chosen frequency, then repeat at a lower level. A deliberately tuned generated unison is available; a deliberately ear-tuned MX029 passage still requires that human judgment.

## Verification and limits

The actual OfflineAudioContext checks cover finite settings including NaN/Infinity, extrema, two-second onset, distinct noise/tone output, 110/220Hz pitch, bounded brightness/movement, an 18-second render spanning two loop joins, low-level stability and zero output after dispose. Tone-only onset initially leaked fading noise; the render regression caught it and now passes after initialization behind the silent envelope. No physical speaker/click assessment is claimed.

The real guarded graph checks silence after Stop during ramps, fixed source/node counts, repeated Start admission, buffering, hidden tab, context suspension, reset and disposal. Host checks exercise pause/resume, seek, source continuity through Original, close/reopen, settings reset, unsupported native WebKit HLS, no Web Audio, failed-download retry, keyboard and 390/768/1440/200% text with reduced motion. Browser results are emulation, not physical devices. Shared host capabilities remain authoritative; native HLS can keep playing while layering is disabled.

Final validation: **131/131 Node tests**, both TypeScript checks, lint, dependency policy and production build passed. **99 HTTP routes / 94 assets** verified. Atmosphere browser suite **18/18 passed**, across Chromium, Android Chromium emulation and mobile WebKit; shared-foundation regressions **17 passed / 4 intentional platform skips**. No complete 444-case browser run or endurance soak was performed. Fresh suite inventory is **174 public + 270 Labs = 444**, zero overlap or omissions. Task04's 18 checks are deliberately internal; public CI coverage is unchanged.

Screenshots: `artifacts/audio-atmosphere/host-chromium-1440.png`, `controls-android-390.png`, and the corresponding 768/1440/200% captures on all three projects. The scoped control-grid alignment fixes an observed stretched level slider; the regression rejects that layout. Mechanical design scan returned no findings. Independent review identified the manual tuning keyboard-entry defect; sequential integer/decimal/blank/out-of-range key-entry regression was red/green after using a draft numeric string and committing/clamping on blur/Enter. No remaining actionable finding was reported. The WebKit cleanup regression also reproduced suppression of `ended` when clearing the stopped buffer immediately; scope-owned release now preserves all three ended events and zero remaining sources. Original/Stop capture is exactly zero on the silent-input guarded graph on all three browsers.

A separate Chromium smoke check used the actual MX029 HLS feed with no fixture substitution: one source advanced to 2.466 seconds with the layer armed, then close paused/removed its src and closed its sole context. Report and screenshot: `artifacts/audio-atmosphere/live-mx029.json` and `live-mx029-desktop.png`. This checks the real source connection, not acoustic quality. Regenerated shared-foundation regression artifacts are copied under the ignored `shared-regression-artifacts/` folder; tracked baseline artifacts were restored to avoid unrelated changes.

Reproduce:

```sh
npm ci
npm test
npm run lint
npm run typecheck:experiences
npm run typecheck:underlevel
npm run check:dependencies
npm run build
PORT=4257 node scripts/serve.mjs
# Separate terminal:
node scripts/check-routes.mjs http://127.0.0.1:4257
ROOM_TEST_ORIGIN=http://127.0.0.1:4257 npm run test:browser:labs -- e2e/audio-atmosphere.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4257/labs/ node scripts/audio-atmosphere-evidence.mjs
```
