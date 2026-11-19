# Memory and fragments implementation plan

**Goal:** Task 05's local `audio-memory` launcher tests whether a recording's recent history complements what follows.

**Spec:** User Task 05 and the existing audio research COMMON brief (read from the foundation checkout; prompt pack is not tracked on master).

**Architecture:** Reuse ResearchHost, ResearchAudio's four-second pre-effect capture and tracked playBuffer voices. One silent layer module owns the fragment's lifetime; its disposal and the shared cancellation generation invalidate pending reads. One retained stereo fragment (0.25–2 seconds), one windowed repetition copy and eight 200ms Hann grains. No extra media/context/capture owner, dependencies, export or reverse.

**Decisions:** The supplied brief selects the product and implementation scope; routine baseline choices are recorded here without reopening design approval. Granular traversal is a twelve-second seeded dissolution, not a phase vocoder or tempo/key detection. Repetition spacing/density uses the shared clock as a free-time 62.5ms grid, explicitly unrelated to source beats. Every start expires after twelve audio seconds; stalls drop expired events. Source continues at its normal position. Stop/bypass/reset/seek/source replacement/close release captured data.

## Tasks

- [x] Capture/DSP: test exact newest known-signal window and ring bound; write failing fragment window/settings/seed tests, then implement bounded preparation and controller. Test pending read cancellation and repeated replacement.
- [x] Launcher/UI: reuse host controls, explicitly start recent listening, capture, compare repetition/dissolution, discard. Visible identity includes selected source and captured media position. Disable unsupported capture and show actionable state. Add internal browser coverage for real output, lifecycle, stalls, async completion after close, native fallback and responsive keyboard layouts.
- [x] Evidence: render short Original/repetition/dissolution examples from verified material, capture screenshot, run required fast gates and focused three-browser tests. Document measured vs heard outcomes honestly in memory-and-fragments.md. Keep local; no commit/push/PR/deployment.

## Review focus

Capture latency and stale-generation completion; partial or silent source windows; rapidly replaced fragments and retiring voices; expired scheduling after stalls; unsupported native HLS preserving playback. Browser signal tests must exercise actual samples, not only controls. Author review after verification; any qualitative musical judgment requires actual listening evidence.

## Progress

Base: origin/master 7874d3d; rebase reports up to date. Baseline Node 131/131 passing. Memory architectural_constraint query returned no rules. No repository AGENTS.md found; supplied global instructions apply.

Completed locally. Final validation: Node138/138; memory+foundation browser32pass/4intentional platform skips; bothTS,lint,dependency policy,build,99routes/94assets pass. Actual liveMX029 Chromium source capture yielded nonzero48kHz stereo and one tracked voice; nativeWebKit progressed while capture stayed disabled, with no context. Independent review fixes are documented in memory-and-fragments.md. Human listening acceptance remains open. User subsequently authorized committing, pushing and opening a PR against master; no deployment is included.
