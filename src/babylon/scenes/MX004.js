import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx009.jpg';

export const cdModelPath = 'models/CD/CD.babylon';
export const caseTexture = CaseTexture;
export const mixId = 515678430;

export const build = ({scene, audio}) => {
  const pipeline = new BABYLON.DefaultRenderingPipeline(
    'default', // The name of the pipeline
    true, // Do you want HDR textures ?
    scene, // The scene instance
    [camera], // The list of cameras to be attached to
  );
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.8;
  pipeline.bloomWeight = 0.3;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;

  var skybox = BABYLON.Mesh.CreateBox('skyBox', 5000.0, scene);
  var skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
    '//www.babylonjs.com/assets/skybox/TropicalSunnyDay',
    scene,
  );
  skyboxMaterial.reflectionTexture.coordinatesMode =
    BABYLON.Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.disableLighting = true;
  skybox.material = skyboxMaterial;
  skybox.visibility = 0;

  var hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
    EnvironmentDDS,
    scene,
  );
  var plastic = new BABYLON.PBRMaterial('plastic', scene);
  plastic.reflectionTexture = hdrTexture;
  plastic.microSurface = 0.96;
  plastic.albedoColor = new BABYLON.Color3(0.206, 0.94, 1);
  plastic.reflectivityColor = new BABYLON.Color3(0.003, 0.003, 0.003);

  const sphere = BABYLON.Mesh.CreateSphere('sphere1', 16, 2, scene, true);
  sphere.material = plastic;

  const createLight = (vector) => {
    const light = new BABYLON.HemisphericLight('Omni0', vector, scene);
    light.diffuse = new BABYLON.Color3(1, 1, 1);
    light.specular = new BABYLON.Color3(1, 1, 1);
  };

  createLight(new BABYLON.Vector3(1, 0, 0));
  createLight(new BABYLON.Vector3(0, 1, 0));
  createLight(new BABYLON.Vector3(0, 0, -1));

  let t = 0;
  let s = 0;
  let colorShift = 0;
  let fade = 0;
  scene.registerBeforeRender(() => {
    camera.alpha = 2.0 * (Math.PI / 20 + Math.cos(t / 35));
    camera.beta = 1.5 * (Math.PI / 20 + Math.sin(t / 50));
    camera.radius = 10 + (-2 + 2 * Math.sin(t / 30));

    const source = this.props.source();
    const avgFreq =
      source && source.isPlaying() ? source.getAverageFrequency() : 0;
    const scale = 0.2 * Math.sin(s) + 1.5;
    sphere.scaling = new BABYLON.Vector3(scale, scale, scale);
    const shift = Math.abs(Math.cos(colorShift));
    const color = new BABYLON.Color3(
      (0.85 * (shift - 0.2) * avgFreq) / 40,
      (0.206 * shift * avgFreq) / 40,
      (0.4 * (shift + 0.05) * avgFreq) / 20,
    );
    plastic.albedoColor = color;
    plastic.emissiveColor = color;

    skybox.visibility = Math.abs(Math.sin(fade));

    t += 0.05;
    s += 0.01;
    fade += 0.00001;
    colorShift += 0.001;
  });

  return scene;
};
