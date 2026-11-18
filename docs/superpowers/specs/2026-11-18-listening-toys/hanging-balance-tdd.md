# Hanging Balance — technical design document

**Status:** Draft prototype design · **Date:** 18 November 2026\
**Labs category:** Experiences · **Proposed ID:** `hanging-balance`\
**Depends on:** [Shared listening-toy contract](README.md)

## 1. Intent

A precarious mobile of unrelated objects hangs in a shallow space: a ceramic bell, a heavy stone, a bent disc, a hollow vessel, and a small object that seems alive. The mix changes the arrangement's tension and sway. A visitor can pull an object, shift a counterweight, or briefly disturb the balance, then watch it settle into a new configuration.

It should feel like a small physical puzzle that never demands solving. Weight, delayed reactions and near-collisions create the interest. It remains enjoyable as a passive listening companion, with the DJ mix as the sole audio output.

## 2. Reference and original direction

- [Vectorpark's Levers](https://vectorpark.com/) is listed by its creator as a game of balance. [The developer's App Store description](https://apps.apple.com/il/app/levers/id326698939?platform=vision) describes balancing hangers and interacting objects to keep them above water.
- Inspected the creator's index on 18 November 2026. Its linked itch.io game returned HTTP 429; live gameplay was not verified. Treat mechanics as documented reference behaviour.
- Adapt connected weights, visible cause/effect and unexpected object behaviour. Do not reproduce Levers' objects, water-failure rule, levels or art.

**Proposed ROOM art:** a restrained tabletop/installation scene in warm gray and ink, with a cobalt ceramic object and one unexpected vermilion detail. Slightly bent rods, unequal suspension lengths and mismatched materials make the arrangement feel assembled. Depth comes from a shallow perspective and contact shading; the interaction stays planar and understandable. One object can slowly turn an aperture toward a neighbour, but there is no character dialogue.

## 3. Prototype boundary and approach

**Minimum slice:** three linked rods, five permanently attached objects, one movable counterweight on the top rod, one fixed camera, one original poster and a small set of stable poses. No add-object UI is needed to prove the concept.

| Approach | Tradeoff |
| --- | --- |
| Full rigid-body physics with freely detachable joints | Broad freedom but difficult collision/constraint stability and awkward mobile picking. Deferred. |
| Planar articulated pendulums rendered in 3D | **Selected proposal.** Legible weight changes, bounded state, predictable interaction, fewer degrees of freedom. |
| Scripted sway only | Easy passive motion, but lacks convincing consequences when the visitor intervenes. Rejected for the core mechanic. |

Use an intentionally approximate mechanical model, not a scientific simulation. The topology is fixed and acyclic. All objects stay attached. Exclude stacking arbitrary user objects, rope simulation, structural breakage, puzzle progression, detached debris, an inventory and audible chimes.

## 4. Passive and interactive behaviour

### Watch

The mobile receives a small continuous wind-like drive and slowly varying torque from the music. Its rods settle at unequal angles and the five objects swing with different lengths. Every 20–35 seconds of active simulation, one object makes a tiny authored weight-shift gesture; this is capped and passed through the same solver as user input. The counterweight is never repositioned by Watch after the visitor has moved it.

No visual balance threshold blocks playback or begins a new level. A heavily tilted arrangement is a valid state. Stops and damping keep it within the camera. The mobile never collapses or fills the view with newly spawned objects.

### Control

Grab any suspended object and pull it across the interaction plane. A compliant spring attracts that object toward the pointer while the connected rods respond. Dragging cannot detach a joint. On release, velocity comes from the simulation, not a raw pointer-speed fling, and is clamped. The host eight-second return blends ambient driving back in without restoring the original arrangement.

Select the counterweight and slide it along the top rod between 20% and 80% of rod length. This changes equilibrium and persists until Reset scene, seek or closing the modal. All five other attachment locations stay fixed. The range control dispatches `set-value` with `control: 'counterweight'`; its normalized range maps to that permitted rail segment. A direct drag projects the pointer onto the same rail and uses the same clamped target. A visible **Nudge** action dispatches `command: 'nudge-object'` with the selected object ID and gives it one small impulse. **Settle** dispatches the scene-wide `command: 'settle'`, releases the grab, zeros initial angular velocities, and eases toward the new static equilibrium over 1.5 seconds with autonomous forcing suppressed. It preserves counterweight position and does not touch playback.

**Keyboard/touch equivalents:** a labelled target list contains the five objects and counterweight. With the canvas focused, arrow keys apply small normalized directional nudges; Left/Right on the counterweight move it by 5% of permitted travel. Provide on-screen directional buttons, a labelled counterweight range input, Nudge and Settle. Direct touch dragging uses generous hit volumes; controls outside the stage scroll normally. Keyboard actions enter the same control mode and timeout path as dragging.

## 5. Musical mapping

| Feature | Visible response | Initial bound |
| --- | --- | --- |
| Bass | A small torque around the primary suspension | Automatic top-rod displacement target within ±3°. |
| Low-mid/intensity | Slow change in drive strength | Ease over 3 seconds; never alter masses or joint topology. |
| Fresh onset | One small impulse to a selected lower object | Global cooldown 600 ms; no impulse while that object is grabbed. |
| High | Tiny orientation change on the disc/detail | ±2° visual detail; not a full-chain shake. |
| Brightness | Slow warm/cool lighting bias | At least 4-second blend. |

Collisions and near-passes produce only visual consequences: slight deformation or a brief local material accent. They do not emit notes. Strong musical moments do not replenish energy without limit. Gentle motion disables transients and self-weight gestures and scales continuous driving to the shared cap.

In ambient mode, a low-amplitude seeded wind replaces audio forces. Keep the physical counterweight and interactivity intact and label the absence of live analysis. Inactive playback freezes the state; no quiet-band threshold changes this playback policy.

## 6. Simulation design

Create `src/experiences/hanging-balance/` with `index.tsx`, `config.ts`, `MobileSimulation.ts`, `mapAudio.ts`, `BabylonMobile.ts`, and `assets/`.

`MobileState` includes each rod's angle/angular velocity, each object's relative pendulum angle/angular velocity, counterweight position, grabbed/selected IDs, control target, seeded gesture timer, and contact cooldowns. Meshes, DOM nodes and audio objects are excluded.

The solver uses SI-like internal units: top rod length 2 units, child rods 1.2 and 0.9, five object masses 0.6–1.8, and suspension lengths 0.35–0.9. Fix these authored values in `config.ts`. Each step computes positions from the hierarchy, aggregates descendant center-of-mass torque upward, adds gravity/drive/grab torque, and integrates angular velocities with damping. Recompute transforms after integration. Use a fixed 1/60-second step and finite clamping inherited from the host.

Initial bounds: rods ±35° from horizontal; object pendulums ±30° from their hanging rest direction; angular speed ≤1.5 rad/s. At a stop, clamp angle and remove outward angular velocity. Cap total per-step external torque so repeated input cannot increase velocity past that bound. The top anchor is fixed. Grabs act through a force-limited target, never teleport the hierarchy.

**Contacts:** position the authored topology so rods and objects are separated at rest. Use circle proxies in the interaction plane for object-object contacts only; on overlap, apply capped separating torques, then clamp limits. Allow residual visual overlap rather than iterating an unstable solver. No restitution-driven bounce chain is required. Inspect worst-case grabbed poses to ensure residual overlap is not visually unacceptable; widen rest spacing or shrink proxies before adding a physics dependency.

Watch uses a bounded driver; after every step the explicit angle/velocity caps guarantee a finite envelope. If any state becomes non-finite, restore the last finite snapshot, clear velocities and pending impulses, and expose a Labs diagnostic recovery count. A release candidate must complete the soak with zero such recoveries; the guard is not acceptance evidence.

Reset/seek restores the authored arrangement with a seed/media-time-derived gentle initial phase and the default centered counterweight. Watch transitions preserve user-adjusted weight position. Close discards it; no saved layout is promised.

## 7. Rendering and controls

Use low-poly original object meshes, simple rods/cord cylinders, baked/static shading and a neutral background. No dynamic shadow map is needed for the first slice. Maintain enough negative space to see attachments. Camera framing encloses the entire documented motion envelope at each supported aspect ratio; never crop the top anchor or controls on mobile.

Provide a selected-object outline and a visible explanation such as **Drag the bell. The rest will follow.** Keep decorative eyes/apertures subtle and do not add per-object labels inside the scene unless selected. A DOM target list provides accessible names independent of canvas picking.

## 8. Milestones and acceptance

1. **Balance slice:** hierarchy, masses and counterweight; deterministic torque response, bounded extremes, and reset/settle behaviour with synthetic inputs.
2. **Touch slice:** compliant dragging, generous hit areas and equivalent keyboard controls; clear visible propagation to linked objects.
3. **Listening slice:** sparse audio forces, ambient fallback and long unattended behaviour without any added sounds.
4. **Labs candidate:** shared launcher/host, original poster and materials, desktop/mobile evidence and runtime/performance gates.

Create `test/hanging-balance.test.mjs` covering:

- Moving the counterweight left/right changes the signed equilibrium response in the expected direction; it is not a cosmetic slider.
- Identical seed/actions/features at fixed steps yield identical finite snapshots.
- Maximum sustained drive, rapid direction changes and repeated nudges stay inside every angle and velocity bound for 30 minutes of simulated time.
- A held object cannot be reclaimed by Watch timeout; releasing does not teleport it or reset counterweight placement.
- One cached onset produces one impulse, and a grabbed target never receives an automatic onset impulse.
- Settle preserves topology/weight position and decays velocities; Reset and seek restore defaults and release captures.
- Absolute counterweight updates require no synthetic grab/release pair; slider pointer-hold prevents timeout, and a Settle command cancels an active scene grab.
- Freeze/ambient/Gentle motion follow the shared contract; invalid feature data creates no external torque.

Browser coverage in `e2e/listening-toys.spec.cjs` must test target selection, counterweight keyboard/range control, pointer cancellation, scene reset without audio seek, hidden-tab resume without a swing explosion, keyboard focus, renderer fallback with continuing mix, and close cleanup.

**Qualitative acceptance:** within a 30-second interaction, a reviewer can deliberately tilt the assembly in both directions and identify the object that caused it. During a five-minute hands-off sample, the arrangement has both stillness and changing relationships. If only the whole structure rocks as one rigid piece, the prototype has not demonstrated the concept.

## 9. Risks and promotion

The key risk is an unstable or visually unconvincing approximate solver. Start with the three rods and bounded degrees of freedom before art polish. If the contact approximation cannot meet the envelope and visibility checks, first reduce collisions by composition; introduce a physics dependency only through an explicit follow-up design decision.

The other risk is turning music into constant shaking. Prefer sustained tension changes and rare impulses. Public integration later supplies the existing record player's features through the shared adapter; it must not create a second stream or add collision sounds by default.
