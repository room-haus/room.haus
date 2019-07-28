import * as BABYLON from 'babylonjs';
import {getMixConfig} from 'src/babylon/scenes';
import {loadCDModel, initCamera, loadSceneAssets} from './BabylonHelpers';

class BabylonSceneManager {
  constructor(canvas) {
    this.scenes = {};
    if (canvas) {
      this.init(canvas);
    }
  }

  init(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.resize = () => this.engine.resize();
    window.addEventListener('resize', this.resize);
  }

  async createScene({id, caseTexture, build, sceneAssetsPath, cdLabelTexture, audio}) {
    let scene = new BABYLON.Scene(this.engine);
    this.scenes[id] = scene;
    if (sceneAssetsPath) {
      scene = await loadSceneAssets(scene, sceneAssetsPath);
    }
    if (caseTexture) {
      scene = await loadCDModel(scene, caseTexture, cdLabelTexture);
    }
    scene = initCamera(scene, this.canvas);
    build({
      scene,
      canvas: this.canvas,
      engine: this.engine,
      audio,
    });
    if (this.onReady) {
      scene.executeWhenReady(this.onReady);
    }
    return scene;
  }

  async runScene(sceneId, params) {
    let scene = this.scenes[sceneId];
    const config = getMixConfig(sceneId);
    this.background = config.Background;
    if (!scene) {
      scene = await this.createScene({...config, ...params});
    }
    this.engine.stopRenderLoop();
    this.engine.runRenderLoop(() => scene.render());
    this.resize();
  }

  cleanUp() {
    window.removeEventListener('resize', this.onResize);
    this.engine.dispose();
  }
}

export default BabylonSceneManager;
