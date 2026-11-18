# Shared listening foundation and Endless Rally implementation plan

> **For agentic workers:** Use superpowers:executing-plans; independent pure mechanics may use dispatching-parallel-agents. Keep all changes local and uncommitted.

**Goal:** Deliver the approved Endless Rally prototype in Labs on a reusable listening host.

**Architecture:** Promote generic Underlevel audio with compatibility exports. A generic React host owns one session, bounded clock, interaction director and renderer lifecycle. Rally owns pure swept geometry, simulation, mapping and Babylon presentation.

**Tech Stack:** Existing React, TypeScript, Babylon 4.2.2, Node tests and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-listening-toys/README.md` and `endless-rally-tdd.md`.

## Global constraints

- Preserve existing uncommitted work and Underlevel imports; no deployment, push, PR or production routes.
- DJ mix only; no impact sounds or playback changes from interaction.
- Fixed 1/60 second steps, maximum 0.05 accumulated seconds; inactive/hidden freezes.
- Watch by default, eight-second timeout after release, 1.5-second authority blend, held pointers never time out.
- Nonreflecting goals at ±3.1; four collision events per step; prediction at most two seconds/eight contacts.
- Reduced motion begins paused; explicit gentle motion at speed 0.6 and motion ≤0.2.

## Review focus

- Seek while hidden resets safely when returning; no elapsed-time catchup.
- Slider capture, pointer cancel and blur release ownership without changing playback.
- Renderer failure and retry leave a single owned audio session.
- Closing during loading/Returning stops playback and destroys listeners/render resources.
- Invalid features and repeated onsets cannot amplify motion or duplicate accents.

## Tasks

- [x] Shared foundation: first add failing clock/director/session tests; promote audio and types, implement bounded clock, accepted-action director and host. Add `typecheck:experiences` while retaining Underlevel check. Verify focused tests and existing audio tests.
- [x] Rally mechanics: first add failing swept-contact, goal-priority, bounded-prediction and deterministic/recovery tests. Implement shared geometry, pure simulation and bounded music mapping under `src/experiences/endless-rally/`. Run 30-minute synthetic soak with zero invalid recoveries.
- [x] Presentation/integration: implement original court and poster, registry and generic modal. Host config provides simulation, renderer, controls, targets and diagnostics; action acceptance returns boolean. The director supplies frame.autonomy for timeout blending; the simulation smooths explicit Watch while preserving physical state.
- [x] Browser verification: add `e2e/endless-rally.spec.cjs` for Watch, manual miss/recovery, keyboard/slider/touch, seek/pause, reduced motion, failure and close cleanup. Inspect desktop/mobile screenshots and measure settled frame timing and resources. Final integrated matrix: 223 passed / 8 platform-specific skips; Rally: 28 passed / 2 desktop-DPR-only skips. Longer live soak and final evidence refresh continue below.
- [x] Acceptance: typechecks, lint, Node suite, build, route checks, audit and browser suites. Independent final review; fix actionable findings. Record actual evidence and limitations in a foundation handoff and prototype report. Final Node105/105; full browser223pass/8skip, shared delta57pass/3skip, refreshed captures3/3. Thirty-minute live MX029 run:937contacts,0invalid recoveries/errors/resets,stable14draws/2988triangles. Software-rendered frame targets remain unmet (desktopp95 33.4ms; mobile-emulatedp95 66.7ms); physical-device and subjective listening limits are explicit in docs/endless-rally/README.md.

## Execution notes

The user explicitly approved the design and continuous implementation. No concept-selection or plan-approval pause is required. Work remains in the requested dirty feature checkout because the uncommitted Underlevel/Labs baseline is required; changes are confined to new toy/foundation files and necessary integration.

Coordination: the user authorized messaging the concurrent Hanging Balance chat. That chat owns shared foundation files; this chat owns Rally, its tests/evidence, and its registry entry. Shared contract changes are recorded in the foundation handoff.
