# Persistent Listening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep one recording playing across in-site navigation, with compact controls and seamless switching when entering another experience.

**Architecture:** Retain the lazy-loaded player/audio owner above the route-dependent presentation. Keep one HLSAudioSource alive across archive/static routes and render a compact control bar via a portal outside inert panels. Mount the full scene only while its experience is visible. Reuse existing playback, progress storage, and stream cancellation behavior.

**Tech Stack:** React 19, native DOM/CSS, existing HLSAudioSource, webpack, Node 24, Playwright.

**Spec:** docs/superpowers/specs/2026-11-17-persistent-listening-design.md

## Global Constraints

- One audio session only; preserve position and play/pause state across in-site navigation.
- Entering a different experience switches and keeps playing when the old session is playing or loading. A paused session stays paused. Initial entry does not autoplay.
- Re-entering the current experience must not restart or replace its audio.
- Close stops/disposes audio and removes the mini player; preserve saved progress.
- No new dependencies. Retain lazy loading, unload scenes off-route, and retain original portrait changes.
- Load /Users/pmarko.alt/.codex/skills/app-design-principles/SKILL.md; preserve ROOM identity, keyboard focus, reduced motion, 44px targets, and mobile safe areas.
- Global controls must remain usable outside the inert #root route panel, with no content occlusion.

## Review Focus

- Leaving during stream startup must continue the intended session; closing or selecting another must prevent delayed playback from reviving it.
- Switching rapidly, including history navigation, must never leave overlapping streams or stale metadata.
- Release track changes and shared timestamp URLs must preserve explicit navigation intent and progress behavior.
- Pause/close controls must remain keyboard-accessible on static panels and avoid focus landing in removed/inert content.
- Reopening the same experience must reuse audio while a newly mounted scene reconnects analysis safely.

### Task 1: Retained audio session and compact controls

**Files:**
- Modify src/pages/index.js for retained player ownership through route changes.
- Modify src/pages/Player.js to separate audio ownership from active scene presentation.
- Create src/components/MiniPlayer.js for global compact controls; extend src/styles/layout.css.
- Modify src/audio/usePlayer.js and/or src/audio/HLSAudioSource.js only if required for lifecycle correctness.
- Modify src/pages/navigation.js only if needed for explicit resume links or same-record history semantics.
- Create e2e/persistent-listening.spec.cjs; update existing loading/navigation tests whose intentional stop-on-leave expectations change.

**Interfaces:** App retains the last selected experience and passes visibility and playback handoff intent to the player. The player provides one shared audio state to Transport and MiniPlayer; there must be no second audio owner. MiniPlayer receives record, track identity, playback controls, close callback, and return callback. Choose names consistent with surrounding code and document them in the report.

- [ ] Write failing browser tests using the existing real WAV/media fixture pattern: play then leave, confirm same Audio instance advances on archive and Collective; pause/resume and close; return to same record without replacement; enter different record with only the new stream playing; paused switch remains paused.
- [ ] Add tests for pending stream leave/close/switch, release tracks, same-record return, history, keyboard access on static panels, and narrow viewport controls not overflowing.
- [ ] Run focused tests and record expected failures before implementation.
- [ ] Implement retained lazy audio ownership and full/compact presentation. Dispose off-route scenes, not the audio session. Keep explicit linked timestamps meaningful; handle autoplay rejection honestly with a usable Play/Retry control.
- [ ] Update only prior tests whose expected stop-on-leave behavior intentionally changes. Do not weaken unrelated assertions or add global retries.
- [ ] Run focused browser tests across Chromium, Android and WebKit, all unit tests, lint, dependency policy, production build and route checks. Use dedicated test/preview ports so other worktrees are not tested accidentally. Run the full browser suite once with an isolated configuration (hard-coded 4173 URLs require careful isolation).
- [ ] Inspect rendered desktop/mobile compact player, keyboard focus, reduced motion and loading/error controls; save screenshots outside tracked source.
- [ ] Self-review and commit the feature, then report exact checks and limitations. Do not push, open PR, merge or deploy this feature; root will review first.
