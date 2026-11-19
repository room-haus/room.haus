# Memory & fragments — Task 05

19 November 2026. Local baseline on `codex/audio-memory`, based/rebased on
`origin/master` `7874d3d`. Prepared for a user-authorized commit, push and PR
against master. No deployment or public integration.

## Try it

Local built preview: <http://127.0.0.1:4266/labs/#audio-experiments> → **Memory &
fragments** (`audio-memory`). The existing Labs session gate remains in use.

1. Play the selected source. MX029 stays selected by default.
2. **Start recent listening** explicitly enables the shared four-second source
   ring; this action adds no audible layer.
3. Choose 0.25–2 seconds, then **Capture fragment**. Its source name, approximate
   media position and actual duration appear next to Discard. Short or silent
   reads remain unavailable for playback, with a retry explanation.
4. Choose **Recognizable repetition** or **Granular dissolution**, density and
   layer level, then **Play fragment**. Change Treatment during playback to
   compare the same fragment; each deliberate change starts another bounded
   audition. Original and Stop effects remove the layer and discard its material.

There is no automatic capture, export, editor, reverse, stem extraction, tempo
matching or hidden source substitution. Generated loop/tone/noise sources must
be chosen explicitly in the shared source selector. The mix keeps playing at
its normal position and rate underneath the layer. Stop effects does not stop it.

## Implementation and bounds

`src/experiences/audio-memory/fragment.ts` consumes the existing ResearchAudio
source capture, module lifetime, tracked `playBuffer` voices and AudioClock.
`index.tsx` uses ResearchHost and the existing registry/modal/named lazy loader.
No new AudioContext, transport, capture worklet or media owner exists in the
experiment. The only shared-interface addition is an additive `sourceLabel`
field in ResearchHost's controls props, identifying the captured source locally.
Other consumers and the default public audio path retain their existing behavior.

| Resource | Bound |
| --- | --- |
| Recent ring | 4 seconds, stereo, at most 96 kHz; 3.072 MB Float32 PCM |
| Retained capture | One stereo fragment, 0.25–2 seconds |
| Playback material | One repetition copy plus eight 200 ms grains |
| Retained fragment PCM | At most 4.3008 MB including capture, repetition and grains at 96 kHz |
| Steady ring + fragment PCM | At most 7.3728 MB; pending shared read/transfer and synchronous preparation are additional bounded transient allocations, not measured total browser heap |
| Pending work | One shared read, one-second shared timeout; no async decode in the experiment |
| Voices | Shared maximum 16 including retiring voices; dense grains measured at no more than 6 admitted/future voices in the guarded test |
| Scheduling | One shared subscription, 100 ms horizon; no animation-frame audio scheduler |
| Audible duration | At most 12 audio seconds per start/treatment change; events that would finish after the deadline are omitted |

Repetition copies use 15 ms linear edge windows. Grains use a full Hann window;
their offsets scan slowly through the capture with a stateless seeded local
scatter. A 62.5 ms free-time grid changes density; it is **not a detected musical
beat grid**. This creates granular dissolution with original-pitch grains, not a
transparent time-stretch algorithm. A prompt first voice is scheduled 25 ms after
the gesture; later events use the shared clock. A stalled thread drops elapsed
events, and a jump beyond the deadline cannot replay them. Cleanup waits for
actual audio time rather than cutting a tail when the lookahead first sees its end.

Original, Stop, Reset, pause, seek, source change, buffering/error, hidden tab,
context suspension and close use shared cancellation. The controller rejects an
old read using both its local epoch and the shared generation; module disposal
releases capture/prepared buffers and callbacks. Owner gates fade over 15 ms,
tracked sources stop within 20 ms, and scoped nodes retire after 25 ms. No buffer
can return through a late read after close. Reset restores default controls.
Natural expiry also discards the fragment. Treatment switching preserves it only
inside an explicitly running audition.

The approach follows the existing shared owner and the
[Web Audio AudioBufferSourceNode scheduling contract](https://www.w3.org/TR/webaudio/#AudioBufferSourceNode).
Playback rate is left at one; stretching is the granular traversal, not a rate
change to either the recording or its fragments.

## Captured samples and examples

`scripts/audio-memory-evidence.mjs` obtains actual pre-effect samples through
ResearchAudio from a MediaElement WAV source, then renders the production
MemoryFragment + AudioClock over six seconds of subsequent source audio.
The source is at shared-equivalent 0.5 headroom; level is 0.5, repetition density
6 and dissolution density 8. The offline guard is omitted and peaks are checked
below its ceiling; actual guarded playback is a separate browser test.

Original/repetition/dissolution WAVs and screenshots live locally in ignored
`artifacts/audio-memory/`. No listener capture is written by the product UI.
The diagnostic script writes only the deliberately selected development sources.
Provenance, exact capture positions, samples, hashes and render peak/RMS are in
[`memory-measurements.json`](memory-measurements.json). The MX029 segments reuse
the existing SHA-256-verified source fixture and decoding helper, without changing
the shared sample library.

| Material | Captured window | Measured result | Listening observation / hypothesis |
| --- | --- | --- | --- |
| Generated 120 BPM diagnostic loop | One second around local 0:00.25–0:01.25 | Nonzero stereo samples; both treatments render over the following six seconds | No subjective audition performed. Repetition should expose the captured rhythmic identity; dense grains may turn transients into a competing flutter. |
| MX029 segment 006, original start about 1:00 | One second near segment start | Nonzero captured PCM; finite Original and layered renders | Complement/distraction unreviewed. Try a short sparse return, then listen for displaced rhythmic attacks. |
| MX029 segment 090, original start about 15:00 | One second near segment start | Pre-effect capture retains source peaks up to 1; output examples remain below guard ceiling | Complement/distraction unreviewed. The loud source window is a useful masking/headroom counterexample, not evidence of enhancement. |
| MX029 segment 210, original start about 35:00 | One second near segment start | Nonzero captured PCM; finite subsequent-music renders | Complement/distraction unreviewed. Compare texture continuity against repetition drawing attention away from subsequent detail. |

These are listening candidates, **not findings that fragments improve music**.
No human/acoustic listening review was available in this run, so there is no
honest claim of what sounded complementary or distracting. Browser clocks and
nonzero samples establish capture/playback only. The examples are provided for
that remaining listening decision; they are not normalized or perceptually
loudness matched. Listen at the same level and compare Original repeatedly.

## Source/browser evidence

| Combination | Actual evidence |
| --- | --- |
| Chromium, regular WAV MediaElement | Captured nonzero generated loop and three verified MX029 WAV excerpts through the real shared source ring, at 24 kHz stereo. This is decoded fixture playback, not live HLS. |
| Chromium + Android Chromium emulation, processable source | Real AudioContext oscillator capture, repeated fragment replacement, audible guarded grains and zero residual layer after bypass; selected generated loop works in the actual modal. |
| Mobile WebKit emulation, processable graph / selected generated WAV | Real oscillator capture and guarded layer work; explicit generated source can be captured and played through the modal. |
| Native WebKit HLS attachment | Deterministic native attachment fixture continues playback; capture stays disabled with an explicit unsupported explanation. This does not establish physical Safari/CDN playback. |
| Missing Web Audio | Deterministic native fixture continues; capture disabled, no silent substitution. |

Actual live-CDN smoke results are saved separately as
`artifacts/audio-memory/live-<browser>.json`; native and processable paths must not
be conflated with the WAV excerpts above. Physical-device and speaker-route
qualification remain open.

The actual configured MX029 HLS smoke also yielded a one-second stereo source
capture in Chromium at 48 kHz (first-channel RMS 0.012392). One shared tracked
voice and one clock subscription were observed after Play fragment. Closing
closed its sole context. Native WebKit's source advanced to 4.8 seconds while
exposing capture/processing/layering as false, with no AudioContext created and
no substituted source. This is an automated browser run, not physical Safari or
an acoustic listening test.

## Verification and reproduction

Mechanics cover the exact newest stereo window across ring wrap, 100 successive
ring allocations, fixed retained PCM across 25 actual-browser captures, finite
windowed boundaries, deterministic seeded scheduling, prompt sparse playback,
same-fragment treatment switching, no early deadline truncation, long stalls,
silent/partial capture rejection and stale async reads after close. Guarded
tests silence the source after capture to prove that playback comes from the
fragment; after bypass its captured output RMS is zero.

The initial offline bitwise comparison found only a 5.96e-8 sample difference
between browser renders. The final check compares the production scheduler's
event times/material choices exactly and rendered samples within 1e-6, rather
than requiring the browser's floating-point summation order to be identical.

Independent review found delayed sparse onset, no same-fragment comparison,
silent/partial capture acceptance, early deadline cleanup, and stale/anonymous
status text. All were addressed; production-clock regressions were observed
red then green. No separate second review is claimed.

```sh
npm ci
npm test
npm run typecheck:experiences
npm run typecheck:underlevel
npm run lint
npm run check:dependencies
npm run build
PORT=4266 node scripts/serve.mjs
# Separate terminal:
node scripts/check-routes.mjs http://127.0.0.1:4266
ROOM_TEST_ORIGIN=http://127.0.0.1:4266 npm run test:browser:labs -- e2e/audio-memory.spec.cjs e2e/audio-research.spec.cjs --workers=1
ROOM_TEST_ORIGIN=http://127.0.0.1:4266/labs/ node scripts/audio-memory-evidence.mjs
ROOM_TEST_ORIGIN=http://127.0.0.1:4266 node scripts/audio-memory-live.mjs
```

The audio-memory lazy chunk is 20,416 bytes / 7,192 bytes gzip, below the
40 KB gzip concept budget. The required DOM controls retain ROOM typography,
44 px targets and reduced-motion compatibility. Desktop/phone layouts at
390/768/1440, keyboard controls and 200% text are checked in browser emulation.
The new spec is explicitly internal in `playwright.suites.cjs`.

Final validation: **138/138 Node tests**, both TypeScript checks, lint, dependency
policy, production build and **99 routes / 94 assets** passed. Focused memory +
foundation browser execution: **32 passed, 4 intentional platform skips** across
Chromium, Android Chromium emulation and mobile WebKit emulation, including all
15 memory cases. Inventory: **174 public + 285 Labs = 459**, zero overlap or
omissions; the complete browser matrix and a long soak were not run. Relevant
logs and the inventory are retained under `artifacts/audio-memory/`.
