import * as BABYLON from 'babylonjs';
import {initCamera, loadCDModel, loadSceneAssets} from './BabylonHelpers';
import {getMixConfig} from './scenes';

export default class BabylonSceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {stencil: true, audioEngine: false});
    this.engine.enableOfflineSupport = false;
    BABYLON.SceneLoader.ShowLoadingScreen = false;
    this.resize = () => {
      this.engine.resize();
      const camera = this.scene?.activeCamera;
      if (!camera || !this.sceneFov || !canvas.clientWidth) return;
      // Preserve the jewel case's horizontal framing on tall phone screens.
      const scale = Math.max(1, 0.68 * canvas.clientHeight / canvas.clientWidth);
      camera.fov = 2 * Math.atan(Math.tan(this.sceneFov / 2) * scale);
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.resize);
      this.observer.observe(canvas);
    } else {
      window.addEventListener('resize', this.resize);
    }
  }

  async run(record, audio, onReady, onError) {
    const config = await getMixConfig(record);
    if (this.closed) return;
    const scene = new BABYLON.Scene(this.engine);
    this.scene = scene;
    scene.skipPointerMovePicking = true;
    await loadCDModel(scene, config.caseTexture, config.cdLabelTexture);
    if (this.closed) return;
    initCamera(scene, this.canvas);
    if (config.sceneAssetsPath) {
      await loadSceneAssets(scene, config.sceneAssetsPath);
      if (this.closed) return;
    }
    config.build({scene, canvas: this.canvas, engine: this.engine, audio, assetsLoaded: Boolean(config.sceneAssetsPath)});
    this.sceneFov = scene.activeCamera.fov;
    this.resize();
    let ready = false;
    let slowFrames = 0;
    this.engine.runRenderLoop(() => {
      if (this.closed) return;
      try {
        audio.processBands();
        scene.render();
        if (!ready && scene.isReady()) {
          ready = true;
          onReady(config.Background);
        } else if (ready && this.engine.getHardwareScalingLevel() < 2) {
          // Full-screen rendering can saturate a phone or software GPU. Only
          // reduce the drawing buffer after sustained slow visible frames.
          const elapsed = this.engine.getDeltaTime();
          slowFrames = !document.hidden && elapsed > 50 && elapsed < 1000 ? slowFrames + 1 : 0;
          if (slowFrames >= 12) {
            this.engine.setHardwareScalingLevel(this.engine.getHardwareScalingLevel() + 0.5);
            slowFrames = 0;
          }
        }
      } catch (error) {
        onError(error);
      }
    });
  }

  cleanUp() {
    if (this.closed) return;
    this.closed = true;
    this.observer?.disconnect();
    window.removeEventListener('resize', this.resize);
    this.engine.stopRenderLoop();
    // Browsers cap simultaneously allocated WebGL contexts, including detached
    // canvases waiting for collection. Relinquish this canvas after navigation.
    const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    const lose = gl?.getExtension('WEBGL_lose_context');
    this.engine.dispose();
    if (!this.canvas.isConnected) lose?.loseContext();
  }
}
