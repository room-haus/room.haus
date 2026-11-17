const fullTurn = 2 * Math.PI;
const secondsPerTurn = 80;

// Pointer movement sets the pose directly. On release, the angular velocities
// converge exponentially to the original turntable speed without resetting the pose.
export function bindLoopMotion(canvas, engine, scene, loop) {
  // The artwork is the hit area, including gaps around the rotated canvas.
  const surface = canvas.parentElement;
  const homeSpeed = fullTurn / secondsPerTurn;
  const decayTime = 0.9;
  let yawSpeed = homeSpeed;
  let pitchSpeed = 0;
  let running = false;
  let lastFrame;
  let drag;
  const events = new AbortController();
  const options = {signal: events.signal};
  const clamp = (value, limit) => Math.min(limit, Math.max(-limit, value));

  function turn(yaw, pitch) {
    loop.rotation.y += yaw;
    loop.rotation.x = clamp(loop.rotation.x + pitch, 1.25);
  }

  function frame() {
    const now = performance.now();
    const dt = (now - (lastFrame ?? now)) / 1000;
    lastFrame = now;
    if (drag) return;
    const decay = Math.exp(-dt / decayTime);
    const distance = decayTime * (1 - decay);
    turn(homeSpeed * dt + (yawSpeed - homeSpeed) * distance, pitchSpeed * distance);
    yawSpeed = homeSpeed + (yawSpeed - homeSpeed) * decay;
    pitchSpeed *= decay;
    scene.render();
  }

  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (drag || !event.isPrimary || event.button !== 0) return;
      if (event.target.closest?.('button, a')) return;
      event.preventDefault();
      surface.setPointerCapture(event.pointerId);
      canvas.focus?.({preventScroll: true});
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp};
      yawSpeed = pitchSpeed = 0;
      canvas.classList.add('is-dragging');
    },
    options,
  );

  surface.addEventListener(
    'pointermove',
    (event) => {
      if (drag?.id !== event.pointerId) return;
      const sensitivity = Math.PI / Math.max(200, canvas.parentElement.clientWidth * 0.55);
      const yaw = (drag.x - event.clientX) * sensitivity;
      const pitch = (drag.y - event.clientY) * sensitivity;
      const dt = Math.max(0.008, (event.timeStamp - drag.time) / 1000);
      const weight = 1 - Math.exp(-dt / 0.035);
      yawSpeed += (clamp(yaw / dt, 3) - yawSpeed) * weight;
      pitchSpeed += (clamp(pitch / dt, 2) - pitchSpeed) * weight;
      turn(yaw, pitch);
      Object.assign(drag, {x: event.clientX, y: event.clientY, time: event.timeStamp});
      scene.render();
    },
    options,
  );

  function release(coast) {
    if (!drag) return;
    const id = drag.id;
    drag = undefined;
    canvas.classList.remove('is-dragging');
    if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    if (!coast) yawSpeed = pitchSpeed = 0;
    lastFrame = performance.now();
  }
  surface.addEventListener(
    'pointerup',
    (event) => {
      if (drag?.id === event.pointerId) {
        const held = Math.max(0, event.timeStamp - drag.time);
        const remaining = Math.exp(-held / 85);
        yawSpeed *= remaining;
        pitchSpeed *= remaining;
        release(running);
      }
    },
    options,
  );
  for (const type of ['pointercancel', 'lostpointercapture']) {
    surface.addEventListener(
      type,
      (event) => {
        if (drag?.id === event.pointerId) release(false);
      },
      options,
    );
  }
  window.addEventListener('blur', () => release(false), options);
  canvas.addEventListener(
    'keydown',
    (event) => {
      const step = Math.PI / 18;
      const delta = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]}[
        event.key
      ];
      if (!delta || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      turn(...delta);
      scene.render();
    },
    options,
  );

  return {
    play() {
      if (running) return;
      running = true;
      lastFrame = undefined;
      engine.runRenderLoop(frame);
    },
    pause() {
      running = false;
      release(false);
      yawSpeed = pitchSpeed = 0;
      engine.stopRenderLoop(frame);
    },
    dispose() {
      release(false);
      events.abort();
      engine.stopRenderLoop(frame);
    },
  };
}
