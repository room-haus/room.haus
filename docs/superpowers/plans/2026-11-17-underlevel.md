# Underlevel vertical slice implementation plan

> **For agentic workers:** Use subagent-driven development within the explicit module ownership below. Read ROOM_THE_UNDERLEVEL_TTD.md as the source of truth.

**Goal:** A 150-second passive corridor → transmitter → hall journey driven by MX029, with optional grid navigation.

**Architecture:** Keep playback/features, deterministic world/navigation, semantic director, Babylon rendering, and React controls separate. Shared TypeScript contracts live in src/experiences/underlevel/contracts.ts. Reuse Babylon 4.2 and the existing canonical HLSAudioSource, including Safari's native playback safeguard. React receives low-frequency status only.

**Tech Stack:** Existing React/Webpack/Babylon, TypeScript for the isolated experience, Node tests and Playwright.

**Spec:** ROOM_THE_UNDERLEVEL_TTD.md

## Global constraints
- Preserve all pre-existing uncommitted Labs and entrance changes; implementation is on codex/underlevel-slice in the current workspace.
- Deterministic authored topology, media-time cues, no forced camera movement in EXPLORE/STILL.
- User-approved MX029; live frequencies, tempo confidence, intensity and interpreted mood shape local response. Major reveal remains cue-controlled.
- No autoplay, combat, inventory, infinite generation, new asset library or per-frame React updates.
- Reduced motion defaults to STILL. One canonical audio element; native playback remains available when analysis/WebGL fails.
- UI uses the app-design-principles skill; retain ROOM typography and sparse editorial controls with charcoal/stone/amber/violet world.

## Review focus
- Seeking backward reconstructs gate/chapter without replaying stale cues.
- Pause, buffering, hidden tabs and teardown do not leak audio or advance navigation.
- Interrupted grid moves and resume use connected routes without walls or snaps.
- Safari native HLS and denied WebGL retain useful playback controls.
- Touch, keyboard, reduced motion and narrow portrait layout remain usable.

### Task 1: Audio worker
- [x] Add FeatureExtractor.ts, AudioController.ts, CueTimeline.ts and focused tests.
- [x] Test silence, bounded normalization, onset cooldown, tempo confidence, pause and seek resets before implementation.
- [x] Reuse HLSAudioSource; sample mutable AudioFrame at 30 Hz; report absent analysis honestly.

### Task 2: Dungeon worker
- [x] Add DungeonGraph.ts and NavigationController.ts plus focused deterministic/collision/control tests.
- [x] Use 4-unit tiles, authored 150-second connected loop, constrained corridor, small transmitter chamber and large hall.
- [x] Implement 300ms manual moves, 90-degree turns, immediate control takeover and optional resume after 12 seconds (never forced).

### Task 3: Rendering worker
- [x] Add BabylonScene.ts consuming only contracts and world data.
- [x] Build three procedural 64px materials, modular masonry/arches/pillars, gate, artifact, fog and restrained responsive lights.
- [x] Use low internal resolution, nearest sampling, limited lights, shared geometry, context-loss fallback and full cleanup.

### Task 4: UX worker
- [x] Add React shell/controls/CSS/poster; use native audio fallback, gesture entry, motion/volume/modes, debug status at 2Hz.
- [x] Connect shared audio/director/navigation/render interfaces through one owned frame loop.
- [x] Check loading/error/retry, keyboard focus and mobile safe areas.

### Task 5: Lead integration and acceptance
- [x] Add TypeScript build support, isolated /underlevel/ entry and Labs experience link.
- [x] Add media-time director and replaceable MX029 cue data; test seek/replay determinism.
- [x] Build, typecheck, lint, run Node tests and browser scenarios including a real MX029 passage.
- [x] Inspect three hero screenshots, desktop/mobile/reduced-motion/fallback and report measured performance separately from physical-device targets.
- [x] Independent review and fixes; record remaining art/mix tuning and deployment limitations.

## Decisions and progress
- TTD supplied by user is the approved design; execute requested worker strategy without another design approval round.
- Existing checkout includes in-progress Labs; preserve it and avoid pulling/rebasing or committing unrelated work.
- Are.na web lookup failed; the public API and original image CDN succeeded. All five reference images were inspected: coarse masonry, centered vanishing point, dark recesses and restricted color informed the scene.

- Review fixes: exclude relic tile from navigation; align manual takeover heading; hold a gate open around a stationary visitor; allow deliberate exploration during pause; resynchronize from media time after hidden-tab playback.
- MX029 first 150 seconds decoded for RMS inspection: deep quiet at 74–77s and strong return at 78s determine the authored gate cue. Full-mix musical cue authoring remains out of this slice.

- Final evidence: build, strict typecheck, lint, 36 unit tests, 98 routes / 96 assets pass. Final affected browser run42pass/3intentional skips;81 unaffected browser checks passed in fullrun. Independent final review has no unresolved blockers. See docs/underlevel/README.md for source-qualified live audio, performance, screenshots and pre-existing audit limitation.
