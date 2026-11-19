# Space & echoes implementation plan

**Goal:** Task 02's local listening baseline, as specified by the user and the audio research COMMON brief.

**Architecture:** One scoped processor supplied to the completed ResearchHost/ResearchAudio. An additive filtered delay or compact generated convolution return preserves unity dry gain through the shared crossfade. Existing owner supplies transport, guard, capture and clock; no new owner or dependency.

**Choices:** Delay/Reverb mode, time/space, feedback/decay, shared effect level, restrained stereo toggle. Free time or deliberate shared manual tempo divisions. Generated close/air IRs use the repository MIT license. No room simulation.

- [x] Add failing parameter, IR and real-browser impulse/tail/output tests; verify red.
- [x] Implement bounded scoped DSP and minimal responsive controls, register audio-space with a named loader.
- [x] Exercise actual shared bypass during tails, source interruptions, failure/retry, layout, keyboard and unsupported native HLS.
- [x] Produce aligned local original/delay/reverb comparisons from shared generated material and provenance-checked MX029 passages; keep caches and renders ignored.
- [x] Record measured results, audition limits, browser/source support, screenshot and later gesture ideas in docs/audio-research/space-and-echoes.md.
- [x] Run Node, types, lint, dependency policy, build, HTTP route checks and focused internal browser checks; review final diff. Initial implementation stayed local; a subsequent user request authorizes committing, pushing and creating a PR. Generated media stays local; no deployment.

Review focus: no duplicate dry gain; maximum feedback decay; shared-clock invalidation; tail removal despite module state; source/controls defaults after replacement. Deliberate tempo/phase setup may be invalidated by Original/pause; divisions use manual BPM only and never an automatic estimate.

Execution: baseline 126/126 Node; parameter/IR tests failed for missing implementation, then passed. Final 128/128 Node plus types/lint/policy/build/routes passed. Real graph tests exercise impulse timing, feedback extremes, tail stop, dry gain and mono/stereo. Selector regression red/green. Review clean for experiment code. Browser verification exposed a shared WebKit launcher dependency also reproduced in pre-space build; reported rather than marking the matrix green. No human audition performed; it remains explicit research acceptance work. The user subsequently requested a PR; the full Node suite passed again before committing.
