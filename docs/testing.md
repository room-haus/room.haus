# Public and internal browser coverage

Normal pull-request and master CI runs public-site E2E only. Internal Labs E2E is an explicit development check and an optional manual CI run. All unit/mechanics tests, both TypeScript checks, lint, dependency policy, build and HTTP route/assets checks remain automatic across the whole repository.

| Command | Scope |
| --- | --- |
| `npm run test:browser:public` | Public entrance, artwork/archive, player, navigation/history, loading/failure, waveform, accessibility and static-page behavior, on all three configured browsers. |
| `npm run test:browser:labs` | Labs login/navigation and six geometry studies, Underlevel, shared listening host, Hanging Balance, Endless Rally and Odd Ensemble, on all three browsers. |
| `npm run test:browser` | Complete suite; retained for explicit local integration checks and backward compatibility. |

Build first (`npm run build`) and install browsers (`npx playwright install chromium webkit`). The commands manage the built preview server. Use `ROOM_TEST_ORIGIN=http://127.0.0.1:4206` to select an isolated local port; every suite uses the same origin and browser projects. Pass `-- --project=chromium` or an individual spec after an npm command for a focused development run.

## CI and release behavior

**Check ROOM** automatically runs the public suite on pull requests and pushes to master. Its manual **Run workflow** input offers `public`, `labs` (default), or `all`. Manual Labs/all runs execute the same fast repository gates before their selected browser suite; neither publishes anything. The workflow selector is available once this workflow revision is on the default branch.

**Publish ROOM** uses the public browser suite for revisions that define it. When publishing/restoring an older revision without the new command, it keeps that revision's original complete browser check, preserving rollback compatibility. No deployment behavior, permissions or publication trigger is changed by this split.

## Maintaining the boundary

`playwright.suites.cjs` is the single explicit list of internal Labs spec files. The Labs configuration includes that list and the public configuration excludes it. New spec files default to public coverage, so a new public test cannot silently disappear from CI. Put a new unlaunched Labs spec in the internal list deliberately. When a feature becomes public, move its applicable coverage into the public suite before launch; keep any prototype-only checks internal. The public site's existing home/type study remains public coverage.

The split does not remove tests or reduce their browser coverage when selected. A complete test-list comparison must show that public and Labs inventories do not overlap and their union equals the complete suite. Long live-media soaks, device benchmarks and qualitative art review remain explicit development/release-readiness work; E2E success does not replace them.

Current verified inventory (18 November 2026): 174 public cases and 153 internal Labs cases,327 total, with no overlap or omissions. The last complete pre-split run passed 316 with 11 intentional platform skips. New public/Labs commands each passed 3/3 representative checks across the configured browsers. Case selection is46.8% smaller in automatic CI; hosted time savings are not yet measured.
