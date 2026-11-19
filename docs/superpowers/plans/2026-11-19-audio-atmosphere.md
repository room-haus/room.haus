# Atmospheric layers implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Keep all changes local and uncommitted per COMMON.md.

**Goal:** A restrained sustained texture over the existing mix, with manual tonal comparison.
**Architecture:** One named lazy launcher supplies a layer module to ResearchHost. Shared ListeningSession, buses, guard, lifecycle and ramp helper remain the only owners. A looping shared seeded noise buffer, sine tone and filter LFO are a fixed three-source graph; no rhythmic scheduling or second player.
**Tech Stack:** Existing TypeScript/React/Web Audio, Node tests and Playwright.
**Spec:** User Task 04 and COMMON.md in the existing prompt pack.

## Constraints and decisions

- Preserve the existing ROOM host UI and modal. Layers start off; explicit start fades in over two seconds. Live texture/brightness/movement/tuning edits ramp over 0.75 seconds. Shared Stop/Original gates retain their immediate 15ms fade.
- Three starting settings: Veil (unpitched), Warm floor (manual 110Hz tone), Suspended (noise/tone blend). Texture crossfade, brightness, movement, tuning and shared layer level only.
- Fixed three sources: two audible, one modulation. No feedback or reverb, no retained capture, one 8-second mono noise buffer. Each arm recreates at most that graph; shared retirement remains bounded.
- Generated sources use repository MIT license; noise reuses shared materials. No key detection, harmonic matching, stems or ducking claims.
- No commit, push, PR, deployment or messages to other chats. Existing dirty primary checkout remains untouched.

## Review focus

Non-finite/out-of-range controls; repeated arming and close during onset; stop during long ramps; source replacement/seek/buffering/hidden tab/context suspension; unsupported native HLS and failed lazy download.

## Tasks

- [x] Write real offline-render tests first: finite bounded signal, audible material distinction, manual tuning, two-second onset, noise loop seam, stationary low-level operation, fixed source/node counts and dispose silence.
- [x] Add bounded layer implementation and manifest; run render tests green.
- [x] Add host controls, three settings, named launcher and internal suite registration. Verify source/lifecycle behavior, keyboard, responsive layouts and retry/fallback.
- [x] Export short same-headroom Original, noise, untuned and tuned references and measurements, plus control screenshots. Document measured outcomes and explicitly pending subjective listening in atmospheric-layers.md.
- [x] Run repository unit/type/lint/dependency/build/HTTP gates and focused three-browser audio checks; review the local diff. Leave work local and uncommitted.

## Publication follow-up

The user subsequently authorized committing, pushing and opening a PR against master. The original local-only constraints above describe the implementation phase; deployment remains out of scope.
