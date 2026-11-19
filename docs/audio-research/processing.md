# Processing baseline — Tone & texture

18 November 2026. Task 01 on `codex/audio-processing`, based on
`origin/master` `8f3cb03`. Prepared for a pull request at the user's request after
local validation. The original dirty checkout is untouched. No deployment,
catalog change or public-player integration.

Open **[local Labs](http://127.0.0.1:4225/labs/#audio-experiments)** → **Tone & texture**
(`audio-processing`). The existing Labs client-side gate still applies. Select
MX029 or the explicitly labelled generated reference, Play source, then Processed.
Original, Stop effects, Reset, pause, seek and close use the shared owner.

## Implementation and controls

Task 00 is present. Before edits, HLSAudioSource, ListeningSession, AudioController,
ResearchAudio and ResearchHost matched the SHA-256 values in the foundation's
`artifacts/audio-research/source-manifest.json`. The supplied COMMON/Task 01 prompt
pack was read from the foundation worktree because it is untracked there and absent
from master. Its selected scope is followed here.

`src/experiences/audio-processing/processor.ts` supplies one `ModuleFactory` via
`research.install('processor', processingProcessor)`. It consumes the existing
context/input, registers every node with `own`, and never touches source transport,
analysis, capture routing, destination or the layer bus. There is no new controller.

| Control | Range / behavior | Default |
| --- | --- | --- |
| Low-pass cutoff | 200–18,000 Hz; 18,000 displays Open and bypasses the filter when movement is off | 8,000 Hz |
| Soft saturation | 0–100% parallel clean/soft blend; `tanh(2.5x)/2.5`, 8,193-point curve, 4× oversampling, unity small-signal slope | 20% |
| Slow filter movement | Off/on; 0.05 Hz sine, ±600 cents, no tempo/grid claim | Off |
| Shared effect level | Original/processed linear blend, 0–100% | 50% |

The non-resonant low-pass has Q = −6.0206 dB (linear Q 0.5). Web Audio interprets
low/high-pass Q in decibels, as specified by the
[Web Audio standard](https://www.w3.org/TR/webaudio-1.0/#filters-characteristics).
At lower sample rates, the base cutoff is limited to 0.3 × sample rate so the
positive movement remains below Nyquist. Movement also engages the filter at Open.
The UI shows the requested base cutoff; actual sample-rate limiting is internal.

All module parameters ramp over 40 ms. The scoped native oscillator uses the
owner's AudioContext time, independently of rendering, reduced motion or DOM
refresh. It creates no scheduled beat events, timers, accompaniment or capture.
The owner gates it on interruption, then disposes its oscillator and all nodes.
Re-arm deliberately starts a fresh movement phase; no backlog or auto-resume.

Original and Processed retain the foundation's fixed −6.0206 dB headroom and final
finite/±0.98 guard. There is no makeup gain, limiter driving or automatic mastering.
Open + zero saturation + movement off is an identity insert. Cutoff and saturation
can be changed while bypassed once source capabilities are ready.

### Small shared changes

- `ResearchHost.showReferenceTools?: boolean` defaults to true. This experiment
  passes false, hiding clock/pulse/layer/capture diagnostic tools while retaining
  the existing source selector, transport, comparison, meter and modal.
- Source replacement now remounts control state and effect-level input, matching
  the new owner's configured defaults. A red/green browser test reproduced the
  formerly stale displayed cutoff (600 Hz displayed while a new module used 8 kHz).
- The source-position slider refreshes immediately after its labelled seek. The
  former 100 ms display delay let a controlled-input change send the previous
  value back to the media element (60 s, then 1.9 s). This was found in real MX029
  playback and reproduced by a fixture regression requiring actual arrival at
  30 s, rather than checking bypass state alone. Source/controller semantics are
  unchanged; the host now displays and retains the requested seek.
- `ramp` explicitly anchors the held/current value at the requested time before
  its next ramp. A real offline render reproduced a 0.3105 single-sample jump after
  a completed ramp; the corrected transition measures 0.000169 maximum step.
  No API signature or source routing changes. This also protects later shared
  comparison/control ramps after their previous automation has completed.

## Measurements and local reference audio

[`processing-measurements.json`](processing-measurements.json) preserves the original
measured baseline, source hashes and browser evidence for comparison. The committed
provenance fixture is `scripts/fixtures/audio-processing-passages.json`. Generated
WAVs, screenshots, caches and run reports are ignored under `artifacts/audio-processing/`;
they are not required to run the app or automated tests. Regenerate the stereo
PCM16/24 kHz excerpts with the command below. Raw renders are unnormalized.
`*-comparison-original.wav` attenuates only the
louder Original to the Processed RMS; `*-comparison-processed.wav` retains its raw
level. This is a render-only audition trim, never a running effect or source-file
rewrite. Matching numerical RMS is not a LUFS or perceptual loudness guarantee.
The encoded comparison WAV pairs were measured again after export: differences
are below 0.00003 dB RMS (the historical `comparisonVerification` record).

The generated 120 BPM loop uses the shared deterministic 909-inspired kit and its
existing MIT material manifest; it is not an authentic hardware recording. Offline
renders use the actual insert, shared 50% balance and fixed 0.5 headroom, without
the final worklet (all measured peaks remain below its ceiling). Separate
`shared-reference-*.wav` captures exercise the actual ResearchAudio guard/output
path for 4.3 seconds. Their capture boundaries can differ by an audio block; the
8-second offline comparisons are sample-aligned.

Regeneration writes these audition pairs in the ignored output directory. Each
prefix produces `-comparison-original.wav` and `-comparison-processed.wav`:

| Audition pair | Filename prefix |
| --- | --- |
| Actual shared-path loop, 4.3 s | `shared-reference` |
| MX029, 1:00 excerpt | `mx029-006` |
| MX029, 15:00 excerpt | `mx029-090` |
| MX029, 35:00 excerpt | `mx029-210` |

| Material / source position | Measured contrast in source | Default Processed RMS difference | Aggressive counterexample RMS difference |
| --- | --- | --- | --- |
| Generated loop, 120 BPM, 0–8 s | Deterministic transients/noise, full original recipe known | −1.45 dB | −1.78 dB |
| MX029, 1:00.006–1:08.006 | 2.0% of mono spectral energy above 2 kHz; crest 11.8 dB | −1.03 dB | −3.83 dB |
| MX029, 15:00.093–15:08.093 | 7.6% above 2 kHz; crest 11.0 dB; higher RMS | −1.41 dB | −3.15 dB |
| MX029, 35:00.218–35:08.218 | 20.2% above 2 kHz; crest 14.8 dB; lower RMS | −1.44 dB | −3.65 dB |

Source times are summed from the actual configured MX029 playlist. Segment URLs,
SHA-256 hashes are recorded in `scripts/fixtures/audio-processing-passages.json`.
The exporter downloads and verifies the pinned playlist and segments into an
ignored cache, then uses ffmpeg to decode eight-second stereo source excerpts.
Verified downloads can be reused offline; changed source hashes fail explicitly.
These contrasts are
measured profiles, not guessed instrument or structure labels. Spectral fractions
use a Hann-windowed FFT of the mono downmix; stereo render RMS includes both channels.

### Research findings / listening status

**No human or acoustic listening review was performed in this task.** Neither
browser playback nor these numerical checks establishes better groove, preserved
recognizability or musical enhancement. The following are audition candidates and
counterexamples, with their evidence boundaries explicit.

| Settings | Intended question | Actual evidence | Listening observation / status |
| --- | --- | --- | --- |
| Open, 0% saturation, movement off, 100% effect | Does the insert preserve identity? | Maximum rendered sample error 0 at 48 kHz; tolerance <1e−6 | Identity measured; no listening claim |
| 8 kHz, 20% saturation, movement off, 50% effect | Can modest peak rounding/top-end reduction retain clarity? | Default examples above; raw RMS −1.03 to −1.45 dB, peaks ≤0.445 for mix excerpts; RMS-matched copies supplied | Candidate for preserving groove/clarity; unreviewed by ear |
| 450 Hz, 100% saturation, movement on, 100% effect | At what point does filtering obscure identity and transients? | Mix RMS −3.15 to −3.83 dB; strong known-tone attenuation; local `*-obscured.wav` examples | Deliberately obscuring candidate; its musical effect remains unreviewed |
| 2 kHz, movement on, saturation off | Is a 20 s sweep slow enough to add motion without visual sync? | 2 kHz sine RMS at 4–5 s is 1.152× the 1–2 s window; no visual timer involved | Only movement measured; no groove judgment |

For listening acceptance, audition the generated comparison pair, then each of the
three MX029 comparison pairs at a fixed comfortable playback level. Note whether
attack definition, high-frequency detail, space and rhythmic feel survive; compare
the raw aggressive examples at equal perceived level separately. Record listener,
date, output device and exact settings before promoting either candidate to a
finding. Stop/Original remains available immediately in the live experiment.

Promising later interactible mappings (proposals, not implemented):

1. A bounded object-height gesture opening the cutoff, with release returning
   slowly to the current base setting. Keep saturation low and comparison explicit.
2. A slow object sway controlling movement depth only, limited to ±half an octave.
   The gesture sets an audio parameter; visual frame timing never schedules audio.

## Verification

- Original baseline Node suite: 122/122, including malformed/out-of-range settings.
  After artifact cleanup: 126/126, including four verified-source-cache regressions;
  lint passes and an empty-cache export recreates all 27 WAVs, matching the original
  offline RMS within 1e−6. Both baseline TypeScript checks,
  lint, dependency policy, production build and 99-route/94-asset HTTP checks pass.
- Processing + shared-foundation browser matrix: 40 passed, 5 intentional skips,
  across Chromium, Android Chromium emulation and iPhone WebKit emulation. Includes
  real module/guard signal graphs, source pause/seek/close/reopen, Original/Stop/Reset,
  failed guard, missing Web Audio, native HLS preservation, chunk failure/retry,
  source replacement defaults, keyboard and 390/768/1440/200% text reflow.
- Known sine through 1 kHz low-pass: 100 Hz −0.086 dB; 1 kHz −6.021 dB;
  8 kHz −37.908 dB. Seeded noise RMS ratio ≈0.200. Saturated 0.9-peak/500 Hz
  sine: settled peak 0.3913, third/fundamental ≈0.189 (bounded, audible-path harmonic
  evidence, not a high-quality oversampling/alias rejection qualification).
- All eight valid parameter extremes remain finite with ≤0.901 peak before shared
  headroom. Shared-owner 4.4 kHz sine: Original RMS ≈0.070711, strong Processed
  ≈0.001270, Original/Stop restoration within 0.001 absolute RMS tolerance. Three
  module creations stop exactly three LFOs; closing releases the context.
- Screenshots and per-browser measurement JSON are in `artifacts/audio-processing/`.
  These are browser emulations, not physical-device, speaker or headphone tests.
  Native WebKit HLS retains its existing native output and disables processing;
  no matched processed comparison is claimed on that path. Historical numeric
  results are retained in `processing-measurements.json`; screenshots and logs are
  regenerated locally rather than committed.
- Real configured-CDN MX029 playback in Chromium also reached 1:00, 15:00 and
  35:00 after the slider correction, armed processing, returned to Original and
  continued at rate 1. There was exactly one media element and one context; close
  released both, with no page errors (the historical `mixPlayback` record). This is an actual-stream
  playback check, separate from musical listening acceptance.

Reproduce from a clean checkout using the Node version in `.nvmrc`, installed npm
dependencies, ffmpeg on PATH and Playwright Chromium/WebKit installed. The first
export needs network access to the pinned source URLs. Source-cache tests use only
a local HTTP fixture and do not require ffmpeg or CDN access.

```sh
npm run build
PORT=4225 node scripts/serve.mjs
# separate terminal
ROOM_TEST_ORIGIN=http://127.0.0.1:4225 npm run test:browser:labs -- e2e/audio-processing.spec.cjs e2e/audio-research.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4225 node scripts/audio-processing-evidence.mjs
```

The exporter writes fresh settings, peaks/RMS, durations and WAV hashes to ignored
`artifacts/audio-processing/render-measurements.json`. It does not rewrite the
committed historical measurements. Set `ROOM_AUDIO_PROCESSING_OUTPUT` to use an
alternative local output/cache directory. It makes no uploads. Concept-specific
lazy code stays below the foundation's 40 KB gzip ceiling; no npm dependencies
were added.
