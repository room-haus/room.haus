import * as BABYLON from 'babylonjs';
import {mixConfigs} from './mixes';
import {loadCDModel, initCamera, loadSceneAssets} from '../utils/BabylonHelpers';

class BabylonSceneManager {
  constructor() {
    this.sceneConfigs = mixConfigs;
    this.scenes = {};
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

  async createScene({id, cdModelPath, caseTexture, build, sceneAssetsPath, cdLabelTexture}) {
    let scene = new BABYLON.Scene(this.engine);
    this.scenes[id] = scene;
    if (sceneAssetsPath) {
      scene = await loadSceneAssets(scene, sceneAssetsPath);
    }
    if (caseTexture) {
      scene = await loadCDModel(scene, cdModelPath, caseTexture, cdLabelTexture);
    }
    scene = initCamera(scene, this.canvas);
    build({
      scene,
      canvas: this.canvas,
      engine: this.engine,
      audio: this.audio,
    });
    if (this.onReady) {
      scene.executeWhenReady(this.onReady);
    }
    return scene;
  }

  async runScene(sceneId) {
    let scene = this.scenes[sceneId];
    const config = this.sceneConfigs[sceneId];
    this.background = config.Background;
    if (!scene) {
      if (!config) {
        throw Error(`No Config for Scene: ${sceneId}`);
      }
      scene = await this.createScene(this.sceneConfigs[sceneId]);
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
