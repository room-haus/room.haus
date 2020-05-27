import * as BABYLON from 'babylonjs';
import {scaleLinear, interpolate} from 'd3';
// import environment from '../../textures/environment.dds';
// import environment from '../../textures/environment.env';
// import environment from '../../textures/EnvironmentSpecularHDR.dds';
// import environment from '../../textures/SpecularHDR.dds';
import environment from '../../textures/graySpecularHDR.dds';

// function sigmoid(t) {
//   return 1 / (1 + Math.pow(Math.E, -t));
// }
class SmoothValue {
  constructor(memory) {
    this.memoryLimit = memory;
    this.memory = new Array(memory).fill(0);
  }
  get value() {
    return this.memory.reduce((total, v) => total + v, 0) / this.memory.length;
  }
  addNewValue(val) {
    this.memory.shift();
    this.memory.push(val);
  }
}

// eslint-disable-next-line
export const createBuild = ([primaryColor, secondaryColor]) => ({scene, audio} = {}) => {
  // const skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
  // skyboxMaterial.backFaceCulling = false;
  // const refTexture = new BABYLON.CubeTexture('//www.babylonjs.com/assets/skybox/TropicalSunnyDay', scene);
  // skyboxMaterial.reflectionTexture = refTexture;
  // skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  // const skybox = BABYLON.Mesh.CreateBox('skyBox', 500.0, scene);
  // skybox.material = skyboxMaterial;

  const CD = scene.getTransformNodeByName('CDChassis');
  // Make sure the CD is rendered in front of everything else i.e. top layer
  CD.getChildren().forEach((child) => (child.renderingGroupId = 1));
  const ac = 1;
  scene.ambientColor = new BABYLON.Color3(ac, ac, ac);

  const shell = BABYLON.Mesh.CreateSphere('sphere', 8, 50, scene, true);
  const mat = new BABYLON.StandardMaterial('mat', scene);
  mat.backFaceCulling = false;
  mat.alpha = 0.7;
  // const c = [0, 255, 0].map((x) => x / 255);
  mat.bumpTexture = new BABYLON.Texture('http://www.synergy-development.fr/equalonyzer/images/grained_uv.png', scene);
  mat.bumpTexture.uScale = 1;
  mat.bumpTexture.vScale = 1;
  mat.reflectionTexture = new BABYLON.Texture(
    'http://www.synergy-development.fr/equalonyzer/images/spheremap.jpg',
    scene,
  );
  mat.reflectionTexture.level = 1;
  mat.reflectionTexture.coordinatesMode = BABYLON.Texture.SPHERICAL_MODE;

  shell.material = mat;

  // scene.clearColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  // const light = new BABYLON.HemisphericLight('plight', new BABYLON.Vector3(0, 1, 0), scene);
  // const light2 = new BABYLON.HemisphericLight('plight2', new BABYLON.Vector3(0, -1, 0), scene);
  // light.diffuse = new BABYLON.Color3(0.3, 0.9, 0.67);
  // // light.specular = new BABYLON.Color3(0.8, 0.5, 0.9);
  // light2.diffuse = new BABYLON.Color3(0.8, 0.7, 0.2);
  // // light2.specular = new BABYLON.Color3(0.8, 0.5, 0.23);
  const sphere = BABYLON.Mesh.CreateSphere('sphere', 48, 3, scene, true);
  const fsphere = BABYLON.Mesh.CreateSphere('sphere', 48, 3, scene, true);
  // sphere.position = new BABYLON.Vector3(0, 0, 4);
  // fsphere.position = new BABYLON.Vector3(0, 0, 4);
  fsphere.isVisible = false;
  const pbr = new BABYLON.PBRMaterial('pbr', scene);
  pbr.clearCoat.isEnabled = true;
  pbr.environmentIntensity = 2;
  pbr.roughness = 0;
  pbr.metallic = 0;
  // scene.createDefaultEnvironment();
  scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(environment, scene);
  // scene.environmentTexture = refTexture;
  sphere.material = pbr;

  const v = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const fv = fsphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

  audio.makeBand('low', {
    lowPass: 90,
    highPass: 30,
  });
  audio.makeBand('high', {
    highPass: 5000,
  });
  const lowScale = scaleLinear()
    .domain([127, 130])
    .range([10, 6]);
  lowScale.clamp(true);
  const highScale = scaleLinear()
    .domain([0, 100000])
    .range([0.01, 0.6]);
  highScale.clamp(true);
  const ampScale = scaleLinear()
    .domain([127, 130])
    .range([0, 1]);
  ampScale.clamp(true);

  let t = 0.0;
  const smoothColor = new SmoothValue(20);
  const smoothScale = new SmoothValue(5);
  const smoothInterval = new SmoothValue(5);
  // const smoothBlue = new SmoothValue(20);
  // const smoothRed = new SmoothValue(20);
  const colorInter = interpolate(primaryColor, secondaryColor);
  const getColor = (colorVal) => {
    const rgbStr = colorInter(colorVal >= 1 ? 1 : colorVal);
    return rgbStr.match(/rgb\(?(\d+), ?(\d+), ?(\d+)\)/).reduce((colors, rgb, index) => {
      if (index > 0) {
        colors.push(parseInt(rgb) / 255);
      }
      return colors;
    }, []);
  };

  scene.registerBeforeRender(() => {
    const lowAmp = audio.getAverageAmplitude('low');
    const highEnergy = audio.getTotalEnergy('high');
    smoothColor.addNewValue(ampScale(lowAmp));
    smoothScale.addNewValue(lowAmp);
    smoothInterval.addNewValue(highEnergy);
    const scale = lowScale(smoothScale.value);
    const interval = highScale(smoothInterval.value);
    // console.log(scale, smoothLow.value, lowAmp);
    // smoothRed.addNewValue((scale - 5) / 5);
    // smoothBlue.addNewValue(interval / 0.2);
    const primaryVal = smoothColor.value * 1.7;
    const inverseVal = 1 - smoothColor.value;
    // console.log(rgbStr, matches);
    pbr.albedoColor = new BABYLON.Color3(...getColor(primaryVal));
    mat.reflectionTexture.level = 1 + interval;
    mat.emissiveColor = new BABYLON.Color3(...getColor(inverseVal));
    // pbr.environmentIntensity = smoothColor.value + 0.4;
    // scene.clearColor = new BABYLON.Color3(...color);
    for (let i = 0; i < sphere.getTotalVertices(); i++) {
      const fx = fv[i * 3 + 0];
      const fy = fv[i * 3 + 1];
      const fz = fv[i * 3 + 2];

      // const speed1 = Math.sin(fy * fx);
      // const speed2 = Math.cos(fx * fz);
      const speed1 = 0.215;
      const speed2 = 0.145;
      v[i * 3 + 0] = fx + (Math.sin(t * speed1 + 0.1 + fy) + Math.cos(t * speed2 + fz)) / scale;
      v[i * 3 + 1] = fy + (Math.cos(t * speed1 + fz) + Math.sin(t * speed2 + fx)) / scale;
      v[i * 3 + 2] = fz + (Math.sin(t * speed1 + fx) + Math.cos(t * speed2 + fy)) / scale;

      // v[i * 3 + 0] = fx + 0.0033 * Math.sin(t * 0.215 + fy) + Math.cos(t * 0.145 + fz) + 0.015;
      // v[i * 3 + 1] = fy + 0.0036 * Math.cos(t * 0.115 + fz) + Math.sin(t * 0.145 + fx) + 0.015;
      // v[i * 3 + 2] = fz + 0.0039 * Math.sin(t * 0.115 + fx) + Math.cos(t * 0.145 + fy) + 0.015;
      // v[i * 3 + 0] = fx + Math.sin(t * speed.x + fy) / 10 + (Math.cos(t * speed2.x + fz) / 10) * amp;
      // v[i * 3 + 1] = fy + Math.cos(t * speed.y + fz) / 10 + (Math.sin(t * speed2.y + fx) / 10) * amp;
      // v[i * 3 + 2] = fz + Math.sin(t * speed.z + fx) / 10 + (Math.cos(t * speed2.z + fy) / 10) * amp;
    }
    sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, v);

    t += interval;

    shell.rotation.x += interval / 400;
    shell.rotation.y += interval / 300;
    shell.rotation.z += interval / 200;
  });
  return scene;
};
