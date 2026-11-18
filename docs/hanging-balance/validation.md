# Hanging Balance verification ledger

Local prototype verification completed 18 November 2026. Preview: **http://127.0.0.1:4194/labs/#interactives**. No deployment, push, PR or production assignment. Performance and physical-device limitations remain open.

## Source and scope

Memory MCP architectural-constraint query returned no matching nodes. No repository/ancestor AGENTS.md or separate validation policy was present; supplied user instructions and the approved listening contract governed this work. Preserved the dirty Labs/Underlevel baseline and concurrent Endless Rally/Odd Ensemble work in place. No reset or clean-HEAD worktree. Only working experiences are registered. Shared audio is promoted once, with Underlevel compatibility exports; the public player is unchanged.

## Completed gates

| Check | Result |
| --- | --- |
| `npm test` on latest source | **105 passed**, zero failed. Includes deterministic mechanical invariants, permanent topology, signed equilibrium, bounded angles/speeds, Settle/reset, onset deduplication, invalid input, shared ownership and a **30-minute simulated** maximum-input stress run with zero recovery. |
| Both experience/Underlevel TypeScript gates and ESLint | All passed on latest source. |
| Production build | Passed; 89 public pages generated. |
| Dependency audit | Zero vulnerabilities. Dependencies were not changed by this implementation. |
| Built HTTP preview | **99 routes and 94 assets passed**. |
| Complete Playwright suite, one worker, three projects | **223 passed / 8 intentional platform-specific skips / zero failures**, 12.8 minutes. Includes Labs, Underlevel, public pages/player and concurrent concepts. |
| Final-build delta: shared listening + Odd Ensemble browser files, three projects | **57 passed / 3 platform-specific skips / zero failures**, 3.7 minutes. Run after rebuilding for the concurrent Odd simulation/Gentle Poke correction. |
| Independent review | Interrupted-seek retry and secondary-touch range findings reproduced and fixed. Reviewer confirmed corrections, with no remaining actionable finding in the final input fix. |

The full browser matrix precedes the final additive Odd correction; the final build, latest unit/static checks and focused delta matrix include it. Logs: `/tmp/hanging-final-browser.log`, `/tmp/hanging-delta-browser.log`, `/tmp/hanging-delta-build.log`, `/tmp/hanging-delta-node.log`. Browser artifacts: `/tmp/hanging-final-browser`, `/tmp/hanging-delta-browser`.

Browser coverage includes no autoplay, one source, keyboard/DOM actions, CDP touch dragging and secondary-pointer rejection, pause/seek/reset, visibility, held controls, reduced-motion transitions, renderer/context loss with retained audio, audio failure/retry, ten playing reopen cycles with listener/context/focus checks, 390/768/1440 layouts and genuine 200% text. Fixture WAV playback, event injection and browser device emulation are synthetic evidence. Platform skips cover Android-only multitouch, desktop wheel/high-DPI cases on mobile, mobile-only targeting on desktop and the existing native-WebKit Underlevel seek test.

## Live original-media evidence

`artifacts/hanging-balance/live-soak.json` records **1,808 seconds elapsed**, 180 samples during a requested 1,800-second passive run, original MX029 media from `https://roomhauscdnprd.blob.core.windows.net/`. All 184 recorded playlist/segment responses returned 200/206.

- Zero page errors, unintended resets or simulation recoveries; simulation time remained monotonic.
- Every sample: **21 meshes, 21 per-frame draw calls, 7,868 triangles, one media element and one running audio context**. Browser-reported heap stayed 21.7 MB (coarse reporting, not a heap-leak proof).
- After close: media paused, context closed, dialog removed, focus returned to **Open Hanging Balance**.
- This soak ran on the HMR-disabled **development preview at 4190**, after the actual-time/resize correction. Later input-only/retry/feature-boundary and HUD fixes were covered by final production tests/captures. It is not a 30-minute soak of the exact final production bundle.

`artifacts/hanging-balance/live-device-emulation.json` records the final built preview at 4194:

| Browser | Original MX029 | Analysis | Interaction/layout/cleanup |
| --- | --- | --- | --- |
| Desktop Chromium, 1440 × 1100 | Playback advanced | Live | Opposite signed equilibrium at left/right weight; 200% widths 1440; no errors; close paused media. |
| Pixel 7 emulation, Chromium, 412 CSS px | Playback advanced | Live | CDP touch grabbed/released bell; opposite equilibrium; 200% widths 412; no errors; close paused media. |
| iPhone 13 emulation, native WebKit, 390 CSS px | Playback advanced | **Ambient** | Native HLS retained playback without analysis; opposite equilibrium; 200% widths 390; no errors; close paused media. |

Final passive/interactive desktop screenshots, Android 200% layout and WebKit controls were visually inspected. Files include `passive-desktop-final.png`, `interactive-desktop-final.png`, `passive-android-final.png`, `interactive-android-final.png`, `controls-webkit.png` and `text-200-{desktop,android,webkit}.png` in `artifacts/hanging-balance/`.

## Resource and timing budgets

Geometry is below the 50-draw-call / 100k-triangle budget. The concept asset is a 932-byte SVG poster; measured production concept JS was approximately 5.2 KB gzip, CSS 1.8 KB gzip, excluding shared chunks. DPR is capped at 1.5 desktop / 1 coarse pointer; no realtime shadows or postprocessing.

Host inventory reported Apple M1 Max / 64 GiB / arm64, but automated Chromium identified **ANGLE Vulkan SwiftShader (LLVM 10.0.0), software rendering**. Other experience soaks ran concurrently. Final 60-second samples:

- Desktop: **p95 50 ms**, max 216.7 ms, 1,768 frames.
- Android-emulated: **p95 33.3 ms**, max 183.4 ms, 3,271 frames.
- Contended 30-minute soak: p95 50.1 ms, max 449.9 ms.

The proposed **20 ms desktop target was not met in this software-rendered environment**. Android emulation does not establish the 34 ms physical-phone target. Physical-GPU/phone performance remains unqualified. No device-performance or production-readiness claim is made.

## Corrections and rejected evidence

The first live soak stopped when a renderer stall falsely triggered a seek reset. `pre-fix-soak.json` is retained but **not acceptance evidence**. The host now measures actual callback execution time and supplies uncapped elapsed time to the media session; only physics is capped. A 700 ms blocked-frame regression reproduced weight resetting from .8 to .5, then passed with .8 retained.

Other reproduced corrections: canvas intrinsic-size ResizeObserver feedback; root overflow expanding Android layout at actual 200% text; native secondary range input stealing a held object; interrupted seek persisting across source replacement; cached onset loss on high-refresh zero-step frames. Draw diagnostics now report per-frame deltas rather than Babylon's cumulative counter. Regression checks cover corrected behavior.

## Remaining limits

No physical phone, hardware-GPU benchmark, human auditory verification or full 61-minute mix qualification was performed. Recorded playback and disposal states support ownership/cleanup but do not replace listening through speakers/headphones. Mechanics are deliberately bounded planar approximations, not a general rigid-body solver. The public borrowed-source adapter and production integration remain outside this prototype.

## Category follow-up
At user request, Hanging Balance moved to Interactives (#interactives). Build and lint passed; six existing category/navigation and ten-cycle playback/focus checks passed across Chromium, Android emulation and mobile WebKit (44.9s). Log: `/tmp/hanging-category-browser.log`. Earlier comprehensive and soak evidence predates this navigation-only change; simulation/audio are unchanged.
