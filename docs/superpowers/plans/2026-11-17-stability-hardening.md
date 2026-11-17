# ROOM stability hardening

> **For agentic workers:** Use superpowers:executing-plans. The user approved the preceding audit and implementation on November 17, 2026.

**Goal:** Close the audited stability gaps without restyling the legacy site.

**Architecture:** Retain React, Webpack, Playwright and Node's test runner. Preserve all existing edits, keep browser tests on the production artifact, and make release/media checks share the application's actual inputs.

**Spec:** The audit and user's implementation request in this chat: repair baseURL, dependency audit gate, enlarged-text access, mobile release qualification, blocked-storage reset; add delayed-operation, reset, accessibility, visual-preservation, scene-media and rollback coverage.

## Global constraints

- Use Node 24.22.3 and the locked dependencies.
- Original checkout and its six uncommitted files remain unchanged. Work in the attached isolation worktree, carrying their contents forward.
- Preserve fonts, colors, artwork, spacing and default motion/drag behavior. Overflow is allowed only when needed for access to enlarged content.
- No Jest, deployment, remote push or production mutation.
- Any dependency exception must name the exact advisory, apply only to development dependencies, expire, and fail closed on other findings or audit errors.

## Review focus

- Slow HLS completion after pause/navigation must never restart abandoned audio.
- Shared links must reset even with storage disabled, without losing the selected release track on refresh.
- Small/landscape/enlarged-text navigation must remain reachable with keyboard and touch.
- Release verification failure must restore the preceding association without overwriting a concurrent release.
- Missing scene media and unrelated security advisories must fail the checks.

## Tasks

- [x] 1. Repair Playwright baseURL; reproduce enlarged-text and storage-reset failures, apply minimal fixes; strengthen reset/cancellation tests and navigation appearance checks.
- [x] 2. Add an executable dependency-audit policy with synthetic failure cases, document the exact temporary development-only exception, and use identical release gates across browsers.
- [x] 3. Centralize scene video paths, include them in media health checks, test the checker with local HTTP fixtures and missing video media.
- [x] 4. Exercise deployment rollback, initial-release rollback, concurrent changes and upload failure through a fake AWS process boundary, never real AWS.
- [x] 5. Run clean install, dependency policy, lint, unit tests, production build, HTTP routes, all browser projects and live media health; inspect screenshots and verify original edits are intact.
- [x] 6. Independent whole-change review, address material findings, rerun affected/full gates as needed and retain the reviewed worktree.

## Evidence

Initial audit: 12 unit tests, lint/build/routes/media passed; uncorrected browser config 81/90, temporary baseURL 90/90. Enlarged 320x568 splash clipping and blocked-storage reset were reproduced in a real browser. Full audit has seven development-chain findings for GHSA-fc5q-39xc-vjpf; production-only audit is clean.

Implementation evidence: the enlarged-text and blocked-storage regressions failed against the unchanged build and passed after minimal CSS/checkpoint fixes. Eight focused browser checks passed. Dependency-policy and media-health tests failed against empty implementations, then passed against real handling. All 24 unit tests pass, including five deployment scenarios that invoke only a fake AWS provider. The live inventory passes 133/133 entries (94 audio, 39 video).

Independent reviewer: no actionable findings; independently ran 11 focused tests, checked all 39 scene path substitutions against the original source and verified original-file hashes. No implementation changes requested. Review approval is conditional on the final full browser run.

Browser harness corrections: the first full run passed 106/108. Two new tests had WebKit-specific setup errors (unsupported mobile wheel input and waiting for unrequested lazy images). Screenshots now explicitly load the filtered wall; scrolling uses actual Android touch input, desktop wheel, and WebKit scroll/focus plus touch-policy assertions. All six affected cross-browser cases pass. Physical iPhone swipe behavior is not established by WebKit emulation.

Dependency decision: retain the locked toolchain and explicitly except only GHSA-fc5q-39xc-vjpf in development nodes until 2026-12-01 00:00 UTC. No patched version is listed. Untrusted glob input remains a risk; all other findings, production exposure, malformed reports and expired exceptions fail closed. This is not a clean raw npm audit.

Final validation (Node 24.22.3): locked clean install succeeded; lint, build, dependency policy and all 24 unit tests passed; 108/108 browser cases passed with no retries; 94 routes and 91 assets verified over HTTP; 133/133 media entries passed. Default desktop splash/archive/Collective screenshots exactly match the original build. Mobile splash geometry/artwork match; differences were confined to text antialiasing in the header after adding scroll containment. Original six uncommitted files remain byte-for-byte unchanged. Evidence is retained in ignored `release/hardening-validation/`. Changes remain uncommitted in the attached worktree on `codex/room-stability-hardening`; no merge, push or deployment occurred.
