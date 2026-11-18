# Odd Ensemble — additive shared interface changes

Odd Ensemble now consumes the established shared foundation in this checkout. Existing Hanging Balance and Endless Rally files remain owned by their builders. This task adds only opt-in shared input configuration and a suspension notification; no audio/session/controller changes.

- `ToySimulation.suspend?():void`: called by `ToyRuntime.suspend()` after release, before clock clear. Clears scheduled discrete reactions without changing numeric poses/velocities. Existing implementations need not implement it.
- `ToyConfig.targetButtons?:boolean`: renders the target choices as visible pressed-state buttons instead of a select.
- `ToyConfig.directionLabels?:{left,right,up,down}`: accessible and visible labels for four directional nudge buttons.
- `ToyConfig.sceneCommand?:ToyCommand`: targeted command dispatched by non-repeating Space on the canvas and a stationary pointer/touch release. With this option, movement under 8 CSS pixels is ignored; crossing 8px makes the gesture a drag and suppresses the release command. Cancellation/blur/lost capture never emits a command. Existing toys without this option retain their existing immediate drag behaviour.

These options are enabled only by Odd Ensemble. The registry adds its working entry and preserves all three existing concepts, including their concurrently assigned categories. No public routes. New tests cover suspension discard, gesture discrimination, frozen input, transport continuity and existing shared regressions. Final results live in docs/odd-ensemble/README.md.

Review correction: ToyRuntime now normalizes Gentle `poke` to `{type:'nudge',targetId,x:0,y:-.2}` before dispatch, so a zero-step resume/reset cannot accidentally use the simulation's prior motion preference and create an impulse. Existing `nudge-object` Gentle normalization remains unchanged. New direct runtime regression verifies immediate reset/resume. The original 500ms Poke cooldown applies only to social propagation, never local tactile feedback.
