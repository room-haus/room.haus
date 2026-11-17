import {
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  Material,
  Mesh,
  Scene,
  StandardMaterial,
  Vector3,
  VertexData,
} from 'babylonjs';

const fullTurn = 2 * Math.PI;
const secondsPerTurn = 80;

// Lift the thirty printed impressions off the page. Each impression is a continuous
// ribbon with its own depth and pitch, carrying the glyph sequence from the original SVG.
function buildRibbons(scene, drawing) {
  const contour = drawing.querySelector('#contour');
  const length = contour.getTotalLength();
  const impressions = [...drawing.querySelectorAll('use')];
  const samples = 192;
  const points = Array.from({length: samples}, (_, i) => contour.getPointAtLength((length * i) / samples));
  const positions = [],
    indices = [],
    uvs = [];
  const sequence = drawing.querySelector('textPath').textContent.trim();
  const glyphs = sequence.slice(0, 10);

  impressions.forEach((impression, row) => {
    const matrix = impression.transform.baseVal.consolidate().matrix;
    const ring = points.map((point) => point.matrixTransform(matrix));
    const layer = row / (impressions.length - 1) - 0.5;
    const start = positions.length / 3;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const angle = u * fullTurn;
      const center = ring[i % samples];
      const next = ring[(i + 1) % samples];
      const previous = ring[(i + samples - 1) % samples];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const tangentLength = Math.hypot(dx, dy);
      const depth = layer * 170 + 38 * Math.sin(2 * angle + layer);
      const pitch = 0.65 * Math.sin(angle + layer * 2.4);
      for (const side of [-1, 1]) {
        const offset = side * 7 * Math.cos(pitch);
        positions.push(
          (center.x - (offset * dy) / tangentLength) / 100,
          -(center.y + (offset * dx) / tangentLength) / 100,
          (depth + side * 7 * Math.sin(pitch)) / 100,
        );
        uvs.push((u * sequence.length) / glyphs.length, (1 - side) / 2);
      }
      if (i < samples) {
        const a = start + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  });

  const mesh = new Mesh('Punctuation ribbons', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.uvs = uvs;
  data.normals = [];
  VertexData.ComputeNormals(positions, indices, data.normals);
  data.applyToMesh(mesh);

  const ink = new DynamicTexture('Punctuation ink', {width: 1024, height: 128}, scene, true);
  const ctx = ink.getContext();
  ctx.font = 'bold 112px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';
  [...glyphs].forEach((glyph, i) => ctx.fillText(glyph, ((i + 0.5) * 1024) / glyphs.length, 101));
  ink.hasAlpha = true;
  ink.wrapU = DynamicTexture.WRAP_ADDRESSMODE;
  ink.update();
  const material = new StandardMaterial('Cobalt ink', scene);
  material.diffuseTexture = ink;
  material.useAlphaFromDiffuseTexture = true;
  material.diffuseColor = Color3.FromHexString('#294bc7');
  material.emissiveColor = Color3.FromHexString('#0c185a');
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.35;
  mesh.material = material;
  return mesh;
}

// Pointer movement sets the pose directly. On release, the angular velocities
// converge exponentially to the original turntable speed without resetting the pose.
function bindLoopMotion(canvas, engine, scene, loop) {
  const homeSpeed = fullTurn / secondsPerTurn;
  const decayTime = 0.48;
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

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (drag || !event.isPrimary || event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp};
      yawSpeed = pitchSpeed = 0;
      canvas.classList.add('is-dragging');
    },
    options,
  );

  canvas.addEventListener(
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
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    if (!coast) yawSpeed = pitchSpeed = 0;
    lastFrame = performance.now();
  }
  canvas.addEventListener(
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
    canvas.addEventListener(
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

export async function createPunctuationLoop(canvas, contourUrl) {
  const response = await fetch(contourUrl);
  if (!response.ok) throw Error('Punctuation contour unavailable');
  const drawing = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  const engine = new Engine(canvas, true, {alpha: true, stencil: false, doNotHandleTouchAction: true}, false);
  try {
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    const camera = new FreeCamera('Print view', new Vector3(0, 0, -10.8), scene);
    camera.setTarget(Vector3.Zero());
    camera.fov = 0.48;
    const light = new HemisphericLight('Paper light', new Vector3(-0.4, 1, -1), scene);
    light.groundColor = new Color3(0.38, 0.42, 0.62);
    const loop = buildRibbons(scene, drawing);
    loop.rotation.x = -0.14;
    loop.rotation.y = -0.22;
    await scene.whenReadyAsync();
    const motion = bindLoopMotion(canvas, engine, scene, loop);
    const resize = new ResizeObserver(() => {
      engine.resize();
      scene.render();
    });
    resize.observe(canvas);
    engine.resize();
    scene.render();
    return {
      play: motion.play,
      pause: motion.pause,
      dispose() {
        motion.dispose();
        resize.disconnect();
        engine.dispose();
      },
    };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
