# Hanging Balance Implementation Plan

> Use superpowers:executing-plans for inline implementation. User approved implementation and verification without another concept/plan approval.

**Goal:** A working local Hanging Balance in Labs with reusable listening infrastructure.
**Architecture:** Registry-driven native modal; one owned listening session; pure fixed-step simulation and separate Babylon renderer. Promote generic Underlevel analysis with compatibility exports.
**Tech Stack:** Existing React, TypeScript, Babylon 4.2, HLS, Node tests and Playwright.
**Spec:** ../specs/2026-11-18-listening-toys/README.md and hanging-balance-tdd.md.

## Constraints
Preserve all checkout changes. No deployment, push, PR, season assignment or new route. DJ mix only, MX029 via media resolver. No dependency upgrade. Fixed 1/60 s steps, 0.05 s accumulator cap, 30 Hz analysis, 8 s control timeout with 1.5 s return. Rods ±35°, pendulums ±30°, speed ≤1.5 rad/s. Reduced motion starts paused, Gentle ≤0.2. Permanent topology: three rods, five objects, one counterweight at 20–80%.

## Review focus
- Async close/retry must never resurrect a session or overlap media.
- Hidden/paused/seek input must release captures without replaying impulses.
- Held slider and scene pointer must not be reclaimed by Watch.
- Renderer/context failure must leave transport working.
- Mobile reflow and keyboard selection must not steal transport keys.

## Tasks
- [x] Add failing runtime and mechanical tests; run to establish missing modules.
- [x] Promote audio contracts/modules; add sequence, clear-analysis API and explicit pause-before-dispose. Add fixed clock, director, session and pure action/runtime contracts.
- [x] Implement bounded mobile model, hierarchy transforms, torque, audio mapping, contacts, reset and settle. Pass deterministic and 30-minute synthetic stress tests.
- [x] Implement original Babylon forms/poster and generic React host with transport, input, fallback and lifecycle. Register only Underlevel and Hanging Balance; generalize modal and counts.
- [x] Extend TS/build/CI; run focused checks, Underlevel regressions, lint, node tests, build, audit and route checks.
- [x] Add browser tests for ownership, cancellation, seek, reduced motion, failure and mobile controls across three projects. Inspect desktop/mobile/200% views and capture screenshots. Measure timing/resource counts and soak; distinguish synthetic, emulated, live and unavailable physical evidence.
- [x] Independent review, fix findings, document reusable interfaces and limitations. Leave local preview running.

## Outcome
Local prototype and checks completed. See `docs/hanging-balance/validation.md` for exact results, source-snapshot distinctions and remaining physical-device, human-listening, full-mix and performance qualification limits. Concurrent tasks registered their own working concepts; preserved all their changes. No deployment/push/PR/production assignment.
