# Underlevel pixel HUD and encounter revision

**Goal:** Make the slice look like a crude, stylized old dungeon game and make the relationship between music, environment and enemies visible.

**Authority:** The user's revision requests a pixel overlay, interactable enemies, stronger signal response and a UX map. The user explicitly chose reactive encounters in DRIFT and click-to-attack in EXPLORE; this supersedes the original TTD's enemy/combat exclusion for this bounded slice.

**Design:** `docs/underlevel/UX-MAP.md`. Keep the current audio transport, route, controls and fallback. Use original tiny bitmap sprites and a chunky stone HUD. No inventory, mandatory victory, random spawns, loot or player damage.

## Ownership and checks

- [x] Encounter worker: fixed world-space foes; three-hit defeat only in EXPLORE; 650ms cooldown; acknowledgment in DRIFT/STILL; seek/loop reset; occlusion and visibility; shared pure signal mapper. Unit tests for input/state/signal boundaries.
- [x] Renderer worker: three pixel billboard character cards, actual mesh picking, attack reactions, coarse palette/dither, stronger bounded world response and minimal particles. Reduced motion and cleanup remain intact.
- [x] UX worker: bitmap heading/frame, stepped meters, mini-map, encounter/action/health/mana plate, message log and signal-map disclosure. Single controller callback for pointer and accessible button. No per-frame React state.
- [x] Lead: mode/action browser tests, tap and keyboard checks, real-mix signal observation, desktop/mobile visual captures, build/type/lint/unit checks and independent review.

## Acceptance

1. The opening frame visibly reads as an intentionally crude game screen.
2. The default DRIFT journey encounters all three enemy types without required input.
3. DRIFT clicks acknowledge without damage. EXPLORE clicks damage, react, and eventually disperse an enemy; no camera mode or playback changes.
4. The UX map names the same mappings the renderer consumes. Quiet, paused, analysis-unavailable and reduced-motion states remain honest.
5. Visible enemy controls work with keyboard and touch. Mobile framing retains the viewport and does not overflow.

The follow-up adds crooked boundary pieces, surreal visitor/weather readouts, card-stock enemies with printed health bars, and music-charged mana. Cast static costs 60% and affects light/creature reactions, with no damage. Independent review fixes include actual camera view-cone targeting, health preservation across background playback and the previously missing local room reaction.
