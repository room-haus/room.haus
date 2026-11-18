# Listening prototypes — combined PR integration

This branch assembles Hanging Balance, Endless Rally and Odd Ensemble, their single shared listening host/audio extraction, generalized Labs registry, controls, tests, original posters, specifications and recorded evidence. All three launch from Labs → Interactives. Underlevel remains under Experiences, and the six geometry studies remain under 3D animations.

## Base and preservation

The implementation checkout at `/Users/pmarko.alt/room.haus` predates the merged Labs, Underlevel and persistent-player changes. The PR is assembled in a separate worktree on `origin/master` at `e5f7ce6`, preserving those newer public-player, navigation, deployment-test and dependency-policy changes. Prototype source and evidence were copied selectively. The original dirty checkout and its running previews were left intact. No dependency upgrade is included.

The shared AudioController, FeatureExtractor and TempoEstimator are promoted from Underlevel once; compatibility exports preserve its imports. No new controller or runtime competes with the shared foundation. The public player's audio owner is unchanged. Motion only interprets the existing DJ recording; no prototype synthesizes audio or changes transport through simulation actions.

## Integration corrections

- Existing master coverage caught a failed-download regression in the generalized registry. `React.lazy` at registry scope retained a rejected import after closing. The existing Underlevel reopen test failed, then passed after registry entries changed to `load: () => import(...)` and the modal created a fresh lazy wrapper per opening. Named lazy chunks are retained. This additive registry interface change is recorded in the foundation handoff.
- The browser suite now consistently honors `ROOM_TEST_ORIGIN`, including its preview server and older absolute-URL tests. Verification uses port4206 so another checkout's port4173 cannot accidentally supply stale bundles. Default behavior remains port4173.
- Underlevel's modal-focus test selects its named launcher now that several launchers exist. Its existing failed-download test is retained.
- CI adds the experiences TypeScript check while retaining master's dependency audit policy. README identifies the three Interactives and their common runtime.

## Evidence scope

The concept ledgers and source manifests preserve the actual pre-PR evidence snapshots: thirty-minute live-CDN soaks, interaction/failure/reduced-motion coverage, desktop/mobile-emulated images and recorded resource/timing limits. Those historical source manifests are not hashes of this integrated PR branch. The integration changes affect registry retry, test-server selection and documentation, not the simulations or renderers.

Software-rendered desktop timing targets were not met; physical-phone/GPU, acoustic and full-mix qualification remain open. These are Labs prototypes, not public-season or production-readiness claims. Retained pre-fix soak files are explicitly rejected evidence. The original silent Odd recording is included for qualitative review.

## Current candidate verification

- Clean master baseline:70 Node tests passed.
- Integrated prototype source:117 Node tests passed; both TypeScript gates, ESLint and the existing dependency-policy gate passed (zero audit findings).
- Final build: passed,89 generated pages; HTTP verification passed99 routes and94 assets on port4206.
- Existing failed-download retry regression: failed before the integration fix, passed after it.
- Independent integration review: no Critical or Important findings; reviewed source/compatibility, modal retry/input/cleanup, test harness, evidence caveats and representative enlarged-text/mobile captures. Markdown hard-break whitespace was normalized without changing design content.
- Full final browser matrix before the requested CI split: **316 passed /11 intentional platform skips /0 failures**,327 enumerated cases across Chromium, Android emulation and mobile WebKit,13.3 minutes. Source hashes matched the recorded candidate after the run. The later suite split changes selection/configuration only; validation is recorded below.

No deployment or public-season integration is part of this PR. The user separately authorized committing and opening the PR after the local prototypes were complete.

## Requested CI policy split after the final full check

The user requested that unlaunched/internal feature E2E no longer burden regular public CI. The complete 327-case check finished first (316 passed / 11 platform skips). Then public and Labs configurations were added, sharing the same browsers, preview origin and test defaults.

- Automatic PR/master CI: 174 public cases. Internal Labs coverage:153 cases, explicitly selectable through `npm run test:browser:labs` or manual Check ROOM workflow input. The existing complete `npm run test:browser` command remains available.
- Inventory comparison: no overlap, no omitted cases, union exactly equals 327. This reduces automatically selected case count by 46.8%; no hosted runtime saving is claimed before measuring CI.
- Both new suite commands executed representative existing checks on all three browsers:3/3 public navigation and3/3 Labs category checks passed. Final Node suite 117/117 and lint passed.
- Workflow YAML parsed successfully; event/input guards selected exactly one expected suite for every automatic/manual combination. The release workflow's actual shell selection was exercised against old/new package manifests with a recording npm stub: old commits retain `test:browser`, new commits select `test:browser:public`. An initial whitespace-sensitive validation assertion was corrected to this executable selection check; no production defect was found.
- Independent follow-up review found no Critical or Important issue in the split or rollback behavior. Deployment triggers, permissions, approval environment and publish steps are unchanged. Hosted Actions has not yet run this branch.

See [testing policy](../../testing.md). Raw integration logs, suite lists, partition results and the pre-split source snapshot are under `artifacts/listening-prototypes/`. Previously reviewed prototype screenshots are retained unchanged; the full integration run did not replace their historical evidence provenance.
