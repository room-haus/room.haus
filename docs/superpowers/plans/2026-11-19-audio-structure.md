# Structural intervention implementation plan

**Goal:** Task 06: a local `audio-structure` launcher with bounded stutter, rhythmic thinning and a sparse generated fill.

**Architecture:** Use the existing ResearchHost, ResearchAudio processor slot, tracked buffer playback and source capture. Free time only; no synchronization claim. Source transport is never manipulated. Preserve the incumbent ROOM research controls and typography.

**Spec:** User Task 06 and COMMON.md from the local audio-research prompt pack (not committed on master); shared-foundation.md and testing.md.

**Decisions:** First accepted press owns pending/active/releasing work. Ignore other presses and key repeats. Release only by matching token; release, pointer cancellation, lost capture and blur cancel immediately. Hard maximum two seconds, default one second. Audio envelopes return the processor to unity even if JS stalls. Original/Stop invalidates pending capture and all ownership through the shared generation. No new shared interface required.

**Review focus:** Pending capture after bypass; stale release after retrigger; prolonged held key; delayed main thread; unsupported or failed capture/kit construction. Each must preserve Original or restore it without transport writes.

- [x] Add failing mechanics/ownership tests, then implement finite fragment/fill builders and processor envelopes in `src/experiences/audio-structure/intervention.ts`.
- [x] Add browser tests for real guarded output and UI lifecycle/input; implement `index.tsx`, scoped CSS, poster and one registry entry. Add the spec deliberately to the internal suite list.
- [x] Render local examples and screenshots. Measure entry/exit and original restoration; exercise pause/seek/buffering/close for all three actions.
- [x] Run Node, TypeScript, lint, dependency policy, production build/routes and focused Labs browser gates. Record source base, bounds, findings, actual listening limits and future interactible mappings in `docs/audio-research/structural-intervention.md`.

Verification: 143 Node pass; both TS, lint, dependency policy, build and 99-route/94-asset check pass. Final Task06+foundation matrix35 pass/4 expected skips; all18 Task06 pass. Seven bounded local renders have exact source return and peaks<=.375. Fresh inventory174 public+303 Labs=477, disjoint and complete.

Final review: fresh read-only reviewer identified stale ownership after an audio deadline when wall cleanup is delayed. Added failing test, fixed audio-time reconciliation, verified five structural mechanics tests and full143-test suite. No other concrete bug reported. No deferred minors. Musical/physical-device acceptance was not reviewed.

Initial delivery was local only. The follow-up authorizes commit, push and a PR against master; generated audio/screenshots remain local and no deployment is included. Original dirty checkout preserved; implementation starts at fetched master `254426f` in a managed task worktree.
