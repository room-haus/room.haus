import * as BABYLON from 'babylonjs';

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene}) => {
  scene.clearColor = new BABYLON.Color4(0.7, 0.3, 0.4, 0);
  const light = new BABYLON.HemisphericLight('hemilight', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  return scene;
};
