# Public and internal browser coverage

Task 06 adds 18 deliberately internal structural-intervention cases. Fresh
inventory: **174 public + 303 Labs = 477**, zero overlap or omissions. Focused
Task 06 + shared-foundation execution passed **35 with 4 intentional platform
skips**; all 18 Task 06 cases passed. The full 477-case suite was not run.
Local WAVs, controls and measurements are in ignored `artifacts/audio-structure/`.
See [`audio-research/structural-intervention.md`](audio-research/structural-intervention.md)
for source invariance, cancellation/deadline evidence and listening limits.

Normal pull-request and master CI runs public-site E2E only. Internal Labs E2E is an explicit development check and an optional manual CI run. All unit/mechanics tests, both TypeScript checks, lint, dependency policy, build and HTTP route/assets checks remain automatic across the whole repository.

| Command | Scope |
| --- | --- |
| `npm run test:browser:public` | Public entrance, artwork/archive, player, navigation/history, loading/failure, waveform, accessibility and static-page behavior, on all three configured browsers. |
| `npm run test:browser:labs` | Labs login/navigation and six geometry studies, Underlevel, shared listening host, Tone & texture processing, Space & echoes, Additional rhythm, Hanging Balance, Endless Rally and Odd Ensemble, on all three browsers. |
| `npm run test:browser` | Complete suite; retained for explicit local integration checks and backward compatibility. |

Build first (`npm run build`) and install browsers (`npx playwright install chromium webkit`). The commands manage the built preview server. Use `ROOM_TEST_ORIGIN=http://127.0.0.1:4206` to select an isolated local port; every suite uses the same origin and browser projects. Pass `-- --project=chromium` or an individual spec after an npm command for a focused development run.

## CI and release behavior

**Check ROOM** automatically runs the public suite on pull requests and pushes to master. Its manual **Run workflow** input offers `public`, `labs` (default), or `all`. Manual Labs/all runs execute the same fast repository gates before their selected browser suite; neither publishes anything. The workflow selector is available once this workflow revision is on the default branch.

**Publish ROOM** uses the public browser suite for revisions that define it. When publishing/restoring an older revision without the new command, it keeps that revision's original complete browser check, preserving rollback compatibility. No deployment behavior, permissions or publication trigger is changed by this split.

## Maintaining the boundary

`playwright.suites.cjs` is the single explicit list of internal Labs spec files. The Labs configuration includes that list and the public configuration excludes it. New spec files default to public coverage, so a new public test cannot silently disappear from CI. Put a new unlaunched Labs spec in the internal list deliberately. When a feature becomes public, move its applicable coverage into the public suite before launch; keep any prototype-only checks internal. The public site's existing home/type study remains public coverage.

The split does not remove tests or reduce their browser coverage when selected. A complete test-list comparison must show that public and Labs inventories do not overlap and their union equals the complete suite. Long live-media soaks, device benchmarks and qualitative art review remain explicit development/release-readiness work; E2E success does not replace them.

Task 00's recorded inventory (18 November 2026, including the audio foundation): 174 public cases and174 internal Labs cases,348 total, with no overlap or omissions. The21 new audio-research cases are deliberately internal in `playwright.suites.cjs`; focused execution passed17 with4 expected platform skips. The last complete pre-split run passed316 with11 intentional platform skips; that is historical evidence, not a full run of the expanded inventory. Hosted time savings are not measured. That snapshot is recorded in `artifacts/audio-research/suite-inventory.json`.

Task 01 adds 24 deliberately internal processing cases. Fresh inventory against
the actual rebased checkout is 165 public + 195 Labs = 360, with zero overlap or
omissions. Automatic CI selects the 165 public cases. Processing and foundation
focused execution passed 40 with 5 intentional platform skips. This is not a full
run of all 360 cases. Recorded inventory: the `browserSuiteInventory` field in
`docs/audio-research/processing-measurements.json`. Processing WAVs, screenshots,
source caches and fresh run reports are ignored in `artifacts/audio-processing/`.

Task03 adds24 deliberately internal rhythm cases (eight per browser project).
Fresh inventory: **174 public + 252 Labs = 426**, zero overlap or omissions.
Focused rhythm execution passed24/24; shared foundation/processing/space regression
execution passed70 with5 intentional platform skips. This is not a run of the full
426-case suite. Inventory and local screenshots/renders are in ignored
`artifacts/audio-rhythm/`; findings and limits are in
[`audio-research/additional-rhythm.md`](audio-research/additional-rhythm.md).

Task04 adds18 deliberately internal atmospheric-layer cases (six per browser).
Fresh inventory: **174 public + 270 Labs = 444**, zero overlap or omissions.
Atmosphere checks passed18/18; shared-foundation regression checks passed17 with
4 intentional platform skips. This is not a full run of all444 cases. Render,
guarded-graph, actual MX029 smoke and layout evidence live locally in ignored
`artifacts/audio-atmosphere/`; findings and listening limits are in
[`audio-research/atmospheric-layers.md`](audio-research/atmospheric-layers.md).

Task05 adds15 deliberately internal memory/fragment cases (five per browser).
Fresh inventory: **174 public + 285 Labs = 459**, zero overlap or omissions.
Memory plus shared-foundation focused execution passed32 with4 intentional
platform skips; all15 memory cases passed. The full459-case browser suite was
not run. Local captures, WAVs, control screenshots and new foundation regression
artifacts are in ignored `artifacts/audio-memory/`. Findings and listening limits:
[`audio-research/memory-and-fragments.md`](audio-research/memory-and-fragments.md).
