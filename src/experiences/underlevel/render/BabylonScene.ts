import {Color4, Engine, FreeCamera, Scene, SceneInstrumentation, Vector2, Vector3, Vector4} from 'babylonjs';
import type {Dungeon, SceneFrame, SceneHandle} from '../contracts';
import {ENEMIES} from '../interaction/EncounterController';
import {CAMERA_VERTICAL_FOV} from '../view';
import {enemySprite} from './enemies';
import {sanctuary} from './sanctuary';
import {surface} from './surfaces';

export function createBabylonScene(
  canvas: HTMLCanvasElement,
  world: Dungeon,
  onFailure: (message: string) => void,
  onEnemy?: (id: string) => void,
): SceneHandle {
  const engine = new Engine(
    canvas,
    false,
    {
      alpha: false,
      audioEngine: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
      doNotHandleContextLost: true,
    },
    false,
  );
  const scene = new Scene(engine);
  const instrumentation = new SceneInstrumentation(scene);
  const lost = (event: Event) => {
    event.preventDefault();
    onFailure('Graphics context lost');
  };
  let disposed = false;
  let observer: ResizeObserver | undefined;
  const target = (event: PointerEvent): string | undefined => {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const hit = scene.pick((event.clientX - box.left) * engine.getRenderWidth() / box.width,
      (event.clientY - box.top) * engine.getRenderHeight() / box.height);
    const meta = hit?.pickedMesh?.metadata;
    if (!meta?.enemyId) return;
    const uv = hit?.getTextureCoordinates();
    return uv && meta.opaqueAt(uv.x, uv.y) ? meta.enemyId : undefined;
  };
  const select = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const id = target(event);
    if (id) onEnemy?.(id);
  };
  const hover = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') canvas.style.cursor = target(event) ? 'pointer' : '';
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('pointerup', select);
    canvas.removeEventListener('pointermove', hover);
    canvas.style.cursor = '';
    observer?.disconnect();
    instrumentation.dispose();
    scene.dispose();
    engine.dispose();
  };
  try {
    scene.clearColor = new Color4(0.042, 0.039, 0.047, 1);
    const camera = new FreeCamera('listener', Vector3.Zero(), scene);
    camera.minZ = 0.055;
    camera.maxZ = 84;
    camera.fov = CAMERA_VERTICAL_FOV;
    scene.activeCamera = camera;
    const kit = sanctuary(world);
    const wall = surface(scene, 'wall', world.seed),
      floor = surface(scene, 'paving', world.seed + 13),
      metal = surface(scene, 'iron', world.seed + 71);
    const mats = [wall, floor, metal];
    for (const [geometry, material] of [
      [kit.stone, wall],
      [kit.paving, floor],
      [kit.iron, metal],
    ] as const) {
      const m = geometry.mesh(material.name, scene);
      m.material = material;
      m.freezeWorldMatrix();
    }
    const gate = kit.gate.mesh('portcullis', scene),
      artifact = kit.relic.mesh('transmitter', scene);
    gate.material = artifact.material = metal;
    gate.position.set(kit.gx, 0, kit.gz);
    artifact.position.set(kit.ax, 0, kit.az);
    for (const m of mats) {
      m.setArray4('lamps', kit.lamps);
      m.setVector3('relic', new Vector3(kit.ax, 2.2, kit.az - 0.6));
      m.setVector3('hall', new Vector3(kit.gx, 4, kit.apse - 3));
      m.onError = () => {
        if (!disposed) onFailure('Graphics shader unavailable');
      };
    }
    const sprites = ENEMIES.map((def) => ({id: def.id, x: def.x, z: def.z, update: enemySprite(scene, def)}));
    const screen = Vector2.Zero(),
      tempo = Vector2.Zero(),
      response = Vector4.Zero(),
      air = Vector4.Zero(),
      echo = Vector4.Zero();
    const resize = () => {
      const w = Math.max(1, canvas.clientWidth),
        h = Math.max(1, canvas.clientHeight);
      const ratio = Math.min(1, 384 / Math.max(w, h));
      screen.set(Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(h * ratio)));
      engine.setSize(screen.x, screen.y);
      mats.forEach((m) => m.setVector2('screen', screen));
    };
    canvas.style.imageRendering = 'pixelated';
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      if (canvas.parentElement) observer.observe(canvas.parentElement);
    }
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('pointerup', select);
    canvas.addEventListener('pointermove', hover);
    return {
      update({navigation, audio, director, reducedMotion, motion, response: signal, encounters}: SceneFrame) {
        if (disposed) return;
        const {pose} = navigation;
        camera.position.set(pose.x, pose.y, pose.z);
        camera.rotation.y = pose.yaw;
        gate.position.y = director.gateOpen * 3.85;
        const moving = audio.playing && !reducedMotion && motion > 0;
        const cadence = signal?.cadence ?? 0;
        const beatPulse = audio.available && audio.bpm > 0 && audio.beatConfidence > .65
          ? signal?.tempoPulse : undefined;
        echo.w = 0;
        for (const sprite of sprites) {
          const state = encounters?.enemies.find((enemy) => enemy.id === sprite.id);
          sprite.update(state, audio.time, moving, cadence, beatPulse);
          if (state && signal && encounters && state.reaction > 0 && state.reaction === encounters.reaction) {
            echo.set(sprite.x, 1.4, sprite.z, signal.reaction);
          }
        }
        artifact.rotation.y = Math.PI / 2 + (moving ? Math.sin(director.cycleTime * .24) * .24 * motion : 0);
        const breath = moving ? Math.max(0, beatPulse ?? 0) : 0;
        artifact.scaling.set(1 + breath * .065, 1 - breath * .035, 1 + breath * .065);
        gate.scaling.x = 1 + (moving ? (signal?.resonance ?? 0) * .024 : 0);
        response.set(
          Math.round((signal?.lantern ?? 0) * 5) / 5,
          signal?.intensity ?? 0,
          signal?.dust ?? 0,
          Math.min(1, director.artifact * .45 + (signal?.runes ?? 0) * .68),
        );
        tempo.set(signal?.tempoPulse ?? 0, signal?.tempoColor ?? 0);
        air.set(
          Math.min(1, (director.palette === 'violet' ? .60 : .02) + director.atmosphere * .20 + response.y * .20),
          director.reveal,
          signal?.fog ?? .45,
          moving ? Math.floor(audio.time * 2) : 0,
        );
        for (const m of mats) {
          m.setVector3('eye', camera.position);
          m.setVector4('response', response);
          m.setVector2('tempo', tempo);
          m.setVector4('air', air);
          m.setVector4('echo', echo);
        }
        engine.beginFrame();
        try {
          scene.render();
        } finally {
          engine.endFrame();
        }
      },
      metrics: () => ({
        fps: Math.round(engine.getFps()),
        meshes: scene.getActiveMeshes().length,
        drawCalls: instrumentation.drawCallsCounter.current,
        width: screen.x,
        height: screen.y,
      }),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
