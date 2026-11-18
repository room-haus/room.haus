# Odd Ensemble Implementation Plan

**Goal:** Build the approved Odd Ensemble local Labs prototype.
**Architecture:** Consume existing ToyConfig, ToyRuntime and ListeningToy, with pure deterministic spring simulation and a Babylon renderer. Add opt-in input affordances to the existing host; no new audio/lifecycle owner.
**Tech Stack:** React, TypeScript, Babylon 4.2.2, Node tests, Playwright.
**Spec:** ../specs/2026-11-18-listening-toys/odd-ensemble-tdd.md and its README.

## Constraints
Keep all work local and preserve all pre-existing changes. Shared host controls transport. Three unequal original vessels; stretch .75–1.35, lean ±15 degrees, aperture 0–1. Ambient behaviour has no fabricated audio bands. Gentle disables transients. No concept reopening, dependency upgrades or copied reference assets.

## Review focus
Pointer cancellation must not poke; a second pointer must not steal input. Held input must survive timeout. A pending neighbour reaction must not replay after suspension. Invalid features and actions remain finite. 390px / real 200% text must retain usable controls.

## Tasks
- [x] Mechanics: add test/odd-ensemble.test.mjs, see failure, implement config.ts, mapAudio.ts and EnsembleSimulation.ts. Verify bounds, replay determinism at 30/60Hz, single-consumption onsets, reaction cooldowns, held ownership, frozen input and reset.
- [x] Presentation: add BabylonEnsemble.ts, original SVG poster/provenance, index.tsx and registry entry. Extend host opt-in config for target buttons, direction labels, Space and stationary-tap command after 8px drag discrimination. Cover browser interactions and failure paths.
- [x] Evidence: run node/type/lint/build/audit/route/browser checks. Capture desktop/mobile passive and interactive, reduced motion, poster and 200% text. Run 30-minute soak and ten reopen cycles; record actual evidence and limitations in docs/odd-ensemble/README.md.

## Execution record
- Foundation is present in the requested checkout. Memory MCP returned no architectural constraints. No repository AGENTS.md found under source/test/docs; supplied global rules apply.
- Ruling: implement in this existing dirty feature checkout to consume the locally established foundation; edit only concept files and necessary opt-in host fields. No commits/push/PR/deployment.
- Ruling: the user has explicitly approved the technical design and requested implementation; proceed without another design/plan approval.
- Shared owners are finishing validation. Additive host changes will be documented in a dedicated Odd Ensemble handoff; do not rewrite their handoff or disturb their running previews.
- Mechanics and shared runtime initially passed 14/14; full repository tests initially 99/99; lint and both typechecks passed; audit found zero vulnerabilities.
- Initial browser matrix: 15/15 passed across Chromium, Android emulation and mobile WebKit after correcting a test that wrongly assumed one Stretch from a bass-compressed pose must exceed rest height.
- Independent review reproduced held-selection mismatch, Gentle reset impulse, release retaining a full stretch, and local pokes swallowed by the group cooldown. All have failing regressions then fixes. Ruling: attention/responder mismatch is also important for the ensemble's social legibility; choose the addressed neighbour once. All 19 focused tests pass after these five fixes.
- Ruling: Gentle Poke is normalized by the existing host runtime into a small downward nudge, just as Hanging Balance normalizes its impulse command. This makes current preference authoritative before any physics step or after reset.
- Deferred minor: renderer currently recalculates deformation for frozen poses; resource counts are stable, but this is a potential battery optimization. Measure before claiming performance.
- First live soak was stopped after review corrections; preserved as pre-review-soak.json, not final acceptance evidence.
- Visual inspection found desktop200% Knuckle button text clipped despite no page overflow. Browser regression reproduced it, then member buttons changed to intrinsic flex basis/wrapping. Camera vertical margin also expanded from1.95 to2.25 to include Knuckle's authored rim at maximum1.35 stretch. These are presentation-only corrections; simulation/host frozen.
- Additional browser test debugging: CDP TouchEnd must contain no active points (verified from installed Playwright protocol.d.ts). Sending TouchEnd with the first point released it; corrected the test to TouchMove with the remaining active point. No production change for this test harness issue.
- The final live soak restarted after the presentation-only text wrapping/framing fixes. Candidate source hashes recorded in artifacts/odd-ensemble/candidate-source.json. No more production changes planned unless validation identifies a concrete defect.
- Final visual fallback inspection found retained drawing-buffer pixels visible in the poster's letterbox margin after synthetic context loss. Added failing browser assertion that the canvas is hidden in fallback; fixed with a concept-scoped visibility rule for non-ready render states. This failure-only CSS does not affect the running thirty-minute simulation; final runtime source hashes remain unchanged. Rebuild and fallback/browser verification follow.

Final evidence:105 Node tests; both TS gates; lint/audit/build;99 routes/94 assets; final Odd23 browser passes/1 CDP-only WebKit skip; shared+Odd57 passes/3 skips on prior CSS snapshot. Live soak1,800.011 seconds/61 samples/83 gestures/83 responses/0 page errors;10 playing reopen cycles with0 active media/contexts and stable20 global listeners after each close. First lazy initialization retains13 listeners above baseline; ownership unproven, no cycle growth. Settled SwiftShader p95desktop50ms (target missed), Android-emulated33.4ms (no physical-phone claim). Full evidence and remaining hardware/art-review limitations: docs/odd-ensemble/README.md. All task work remains local.
