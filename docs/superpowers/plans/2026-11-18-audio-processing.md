# Processing baseline implementation plan

Goal: implement Task 01 locally using Task 00's verified owner and plain host.
Spec: supplied Task 01 and COMMON.md (prompt pack in the foundation worktree).

Architecture: one processor factory, no transport or routing changes. A fixed-Q
low-pass with an Open endpoint feeds a parallel dry/soft-saturation blend.
One scoped 0.05 Hz oscillator moves filter detune by at most half an octave.
All controls ramp over 40 ms; shared comparison gates retain their 15 ms ramps
and fixed −6 dB headroom. No gain makeup or normalization. Defaults: 8 kHz,
20% saturation, movement off, shared effect level 50%.

- [x] Add failing parameter and real-browser signal tests; confirm red.
- [x] Implement bounded processor and scoped oscillator disposal; verify identity,
  known tones/noise, distortion, extremes and update transitions.
- [x] Add one named lazy launcher and three controls to the shared ResearchHost;
  add an optional flag hiding routing-check tools, defaulting to existing behavior.
- [x] Verify actual owner output, Original/Stop/Reset, pause/seek/failure/close,
  native/missing capability and chunk retry; inspect 390/768/1440 and 200% text.
- [x] Render short reference and configured-mix examples; record measured levels,
  passage identities and listening limits in docs/audio-research/processing.md.
- [x] Run repository unit/type/lint/dependency/build/route gates and focused internal
  browser checks, then review final diff. Keep changes uncommitted and local.

Review focus: control state after source/reset; LFO cleanup on interruption;
unavailable native playback; exact Open/zero identity; source time/rate unchanged.
Musical quality cannot be inferred from measurements; do not invent listening.

Verification: 122 Node tests; both TS checks, lint, dependency policy, build and
99 routes/94 assets passed. Focused browser matrix 40 pass/5 intentional skips;
final CSS layout delta 3/3 passed. Independent reviewer: no actionable findings;
repeated settled/in-flight ramp render maximum step 0.000521. Implementation remained
local through validation; the subsequent user request authorizes commit, push and PR.

Implementation adjustments: a real settled-ramp discontinuity required a shared
current-time anchor; source replacement needed control remounting. Both were
reproduced before fixing and documented in the processing handoff. No new
controller or routing owner was introduced. Musical listening remains unreviewed.

Final live-check correction: controlled source slider restored its old value on
a subsequent change event. Immediate refresh after the labelled seek preserves
the requested position; actual-position regression RED then final matrix GREEN.
Real MX029 checked at 60/900/2100 s, one media/context, rate 1 and clean close.

PR cleanup at the user's request: generated binary evidence, screenshots, logs
and run reports remain local and ignored. Keep one compact historical measurements
document and the pinned source manifest. The exporter recreates source WAVs using
hash-verified downloads and ffmpeg; automated cache tests exercise local HTTP,
offline reuse, corrupt-cache recovery and changed-source rejection.
