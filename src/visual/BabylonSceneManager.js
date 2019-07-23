import * as BABYLON from 'babylonjs';
import {getMixConfig} from './mixes';
import {loadCDModel, initCamera, loadSceneAssets} from '../utils/BabylonHelpers';

class BabylonSceneManager {
  constructor(canvas) {
    this.scenes = {};
    this.init(canvas);
  }

  init(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.onResize = () => this.engine.resize();
    window.addEventListener('resize', this.onResize);
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
  }

  cleanUp() {
    window.removeEventListener('resize', this.onResize);
    this.engine.dispose();
  }
}

export default BabylonSceneManager;
