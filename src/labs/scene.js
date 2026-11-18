import {ArcRotateCamera, Color3, Color4, DynamicTexture, Engine, HemisphericLight, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer, VertexData} from 'babylonjs';

const TAU = Math.PI * 2;

export function createStudy(canvas, id, getState) {
  if (!Engine.isSupported()) throw Error('WebGL unavailable');
  const engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true, powerPreference: 'low-power'});
  let scene;
  try {
    scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    const camera = new ArcRotateCamera('camera', -Math.PI / 2.7, 1.08, 13, Vector3.Zero(), scene);
    camera.attachControl(canvas, false);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 25;
    camera.lowerBetaLimit = 0.2;
    camera.upperBetaLimit = Math.PI - 0.2;
    camera.wheelPrecision = 35;
    camera.pinchPrecision = 70;
    camera.panningSensibility = 0;
    // Keyboard orbit is handled below so it works on a focused canvas without capturing the page.
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    const light = new HemisphericLight('sky', new Vector3(-1, 2, -1), scene);
    light.intensity = 1.15;
    light.groundColor = new Color3(0.58, 0.6, 0.72);
    const rim = new PointLight('rim', new Vector3(5, 6, -5), scene);
    rim.intensity = 0.8;
    const root = new TransformNode('study', scene);
    const material = new StandardMaterial('ink', scene);
    material.diffuseColor = Color3.FromHexString(getState().settings.color);
    material.specularColor = new Color3(0.28, 0.28, 0.32);
    material.backFaceCulling = false;
    const accent = new StandardMaterial('silver', scene);
    accent.diffuseColor = new Color3(0.75, 0.76, 0.71);
    accent.specularColor = Color3.White();
    const pieces = [];
    let surface;
    let basePositions;
    let grid;
    let time = 0;
    let color = '';
    let disposed = false;
    const pointer = {x: 0, y: 0, active: false};
    function add(mesh, mat = material) { mesh.parent = root; mesh.material = mat; return mesh; }

    if (id === 'kinetic-type') {
      const texture = new DynamicTexture('room-type', {width: 512, height: 192}, scene, false);
      texture.hasAlpha = true;
      const context = texture.getContext();
      context.clearRect(0, 0, 512, 192);
      context.font = 'bold 154px Arial, sans-serif';
      context.textAlign = 'center';
      context.fillStyle = '#ffffff';
      context.fillText('ROOM', 256, 151, 505);
      texture.update();
      material.diffuseTexture = texture;
      material.useAlphaFromDiffuseTexture = true;
      material.emissiveColor = Color3.FromHexString(getState().settings.color).scale(0.2);
      // Tangent text planes describe a toroidal volume; each band counter-rotates.
      for (let band = 0; band < 13; band++) {
        const loop = new TransformNode('type-band-' + band, scene);
        loop.parent = root;
        const phi = band / 13 * TAU;
        const radius = 2.75 + Math.cos(phi) * 1.05;
        for (let index = 0; index < 12; index++) {
          const theta = index / 12 * TAU;
          const mesh = MeshBuilder.CreatePlane('word', {width: radius * 0.49, height: 0.4, sideOrientation: Mesh.DOUBLESIDE}, scene);
          mesh.parent = loop;
          mesh.material = material;
          mesh.position.set(Math.cos(theta) * radius, Math.sin(phi) * 1.3, Math.sin(theta) * radius);
          mesh.rotation.y = -theta - Math.PI / 2;
          mesh.rotation.x = -phi * 0.3;
        }
        pieces.push(loop);
      }
      root.rotation.z = -0.24;
    } else if (id === 'elastic-grid') {
      grid = Array.from({length: 27}, (_, row) => Array.from({length: 27}, (_, col) => new Vector3((col - 13) * 0.32, 0, (row - 13) * 0.32)));
      surface = MeshBuilder.CreateLineSystem('grid', {lines: [...grid, ...grid[0].map((_, col) => grid.map(row => row[col]))], updatable: true}, scene);
      surface.parent = root;
      root.rotation.z = -0.12;
    } else if (id === 'disc-orbit') {
      for (let index = 0; index < 9; index++) {
        const disc = add(MeshBuilder.CreateTorus('disc', {diameter: 2.05, thickness: 0.66, tessellation: 64}, scene), index % 3 === 0 ? material : accent);
        disc.scaling.y = 0.055;
        pieces.push(disc);
        const label = MeshBuilder.CreateTorus('label', {diameter: 0.95, thickness: 0.22, tessellation: 48}, scene);
        label.parent = disc;
        label.material = material;
        label.position.y = 0.4;
      }
    } else if (id === 'folded-matter') {
      surface = add(MeshBuilder.CreateGround('paper', {width: 7.5, height: 7.5, subdivisions: 65, updatable: true}, scene));
      basePositions = Array.from(surface.getVerticesData(VertexBuffer.PositionKind));
      root.rotation.set(-0.18, 0.2, -0.3);
    } else if (id === 'particle-field') {
      const source = add(MeshBuilder.CreateSphere('particle', {diameter: 0.085, segments: 4}, scene));
      for (let index = 0; index < 800; index++) {
        const particle = source.createInstance('particle-' + index);
        particle.parent = root;
        const y = 1 - index / 799 * 2;
        const radius = Math.sqrt(1 - y * y);
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        pieces.push({mesh: particle, x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, phase: index * 0.12});
      }
      source.isVisible = false;
    } else {
      material.emissiveColor = Color3.FromHexString(getState().settings.color).scale(0.35);
      for (let index = 0; index < 28; index++) {
        const loop = add(MeshBuilder.CreateTorus('light-loop', {diameter: 5.5, thickness: 0.035, tessellation: 96}, scene));
        pieces.push(loop);
      }
    }

    function move(event) {
      const box = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - box.left) / box.width * 2 - 1;
      pointer.y = 1 - (event.clientY - box.top) / box.height * 2;
      pointer.active = true;
    }
    function leave() { pointer.active = false; }
    function key(event) {
      const step = 0.12;
      if (event.key === 'ArrowLeft') camera.alpha -= step;
      else if (event.key === 'ArrowRight') camera.alpha += step;
      else if (event.key === 'ArrowUp') camera.beta = Math.max(0.2, camera.beta - step);
      else if (event.key === 'ArrowDown') camera.beta = Math.min(Math.PI - 0.2, camera.beta + step);
      else if (event.key === '+' || event.key === '=') camera.radius = Math.max(5, camera.radius - 0.6);
      else if (event.key === '-') camera.radius = Math.min(25, camera.radius + 0.6);
      else return;
      event.preventDefault();
    }
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('keydown', key);
    function resize() {
      engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
      engine.resize();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (canvas.clientWidth / canvas.clientHeight < 1.15) camera.radius = 16;
    function render() {
      if (disposed || document.hidden) return;
      const {settings, paused} = getState();
      if (!paused) time += Math.min(engine.getDeltaTime(), 50) / 1000 * settings.speed;
      const intensity = settings.intensity;
      if (color !== settings.color) {
        color = settings.color;
        material.diffuseColor = Color3.FromHexString(color);
        if (id === 'kinetic-type' || id === 'light-sculpture') material.emissiveColor = material.diffuseColor.scale(0.25);
      }
      material.wireframe = settings.wireframe;
      accent.wireframe = settings.wireframe;
      if (id === 'kinetic-type') {
        pieces.forEach((loop, index) => {loop.rotation.y = time * (index % 2 ? 0.2 : -0.2); loop.scaling.y = intensity;});
        root.rotation.y = time * 0.1;
      } else if (id === 'elastic-grid') {
        for (const row of grid) for (const point of row) {
          const distance = Math.hypot(point.x - pointer.x * 4, point.z + pointer.y * 4);
          point.y = (Math.sin(point.x * 0.9 + time * 1.7) * Math.cos(point.z * 0.8 - time) * 0.55 + (pointer.active ? Math.exp(-distance * distance * 0.5) * 1.5 : 0)) * intensity;
        }
        surface = MeshBuilder.CreateLineSystem('grid', {lines: [...grid, ...grid[0].map((_, col) => grid.map(row => row[col]))], instance: surface}, scene);
        surface.color = material.diffuseColor;
      } else if (id === 'disc-orbit') {
        pieces.forEach((disc, index) => {
          const angle = index / pieces.length * TAU + time * 0.3;
          const radius = 2.7 + Math.sin(index * 2) * 0.7;
          disc.position.set(Math.cos(angle) * radius, Math.sin(angle * 2 + index) * intensity * 1.5, Math.sin(angle) * radius);
          disc.rotation.set(index * 0.5 + time * 0.2, angle, Math.cos(time + index) * 0.4);
        });
      } else if (id === 'folded-matter') {
        const positions = surface.getVerticesData(VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
          const x = basePositions[i];
          const z = basePositions[i + 2];
          positions[i + 1] = (Math.sin(x * 1.8 + time) * 0.55 + Math.cos(z * 1.4 + time * 0.6) * 0.6 + Math.sin(x + z) * 0.4) * intensity;
        }
        surface.updateVerticesData(VertexBuffer.PositionKind, positions);
        const normals = [];
        // Recompute the normals so the folded sheet catches light as its geometry changes.
        VertexData.ComputeNormals(positions, surface.getIndices(), normals);
        surface.updateVerticesData(VertexBuffer.NormalKind, normals);
        root.rotation.y = time * 0.1;
      } else if (id === 'particle-field') {
        pieces.forEach(({mesh, x, y, z, phase}) => {
          const swell = 3 + Math.sin(time * 1.5 + phase) * intensity * 0.45;
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          const push = pointer.active ? Math.exp(-distance * 4) * intensity : 0;
          mesh.position.set(x * (swell + push), y * (swell + push), z * swell);
        });
        root.rotation.y = time * 0.15;
      } else {
        pieces.forEach((loop, index) => {
          const t = index / pieces.length;
          loop.rotation.set(t * Math.PI, time * 0.2 + t * intensity * Math.PI, t * Math.PI * 0.5);
          const scale = 0.65 + Math.sin(t * Math.PI) * 0.35;
          loop.scaling.setAll(scale);
        });
        root.rotation.z = time * 0.12;
      }
      scene.render();
    }
    render();
    engine.runRenderLoop(render);
    return {
      save() {
        render();
        return new Promise((resolve, reject) => canvas.toBlob(blob => {
          if (!blob) {reject(Error('Image export failed')); return;}
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = 'room-labs-' + id + '.png';
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, 'image/png'));
      },
      dispose() {
        disposed = true;
        observer.disconnect();
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerleave', leave);
        canvas.removeEventListener('keydown', key);
        camera.detachControl();
        engine.stopRenderLoop();
        scene.dispose();
        engine.dispose();
      },
    };
  } catch (error) {
    scene?.dispose();
    engine.dispose();
    throw error;
  }
}
