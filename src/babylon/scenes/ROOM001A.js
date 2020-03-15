import * as BABYLON from 'babylonjs';
import CaseTexture from '../../images/mix-art/mx055.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_MX047.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

// better random function
function rnd(min, max) {
  return Math.random() * (max - min + 1) + min;
}

const within = (val, threshold) => {
  return val >= -threshold && val <= threshold;
};

const allWithin = (val, x, y, z) => {
  return within(x, val) && within(y, val) && within(z, val);
};

// Create random cubes in a box of 100x100x100
function createCubesBall(num, scene) {
  const cubes = [];
  for (let i = 0; i < num; i++) {
    if (i === 0) cubes[i] = BABYLON.Mesh.CreateBox('b', 0.05, scene);
    else cubes[i] = cubes[0].createInstance(`b${i}`);

    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = rnd(-5, 5);
      y = rnd(-5, 5);
      z = rnd(-5, 5);
    } while (allWithin(1.5, x, y, z));

    cubes[i].scaling = new BABYLON.Vector3(rnd(1.0, 1.5), rnd(1.0, 1.5), rnd(1.0, 10.0));

    cubes[i].position = new BABYLON.Vector3(x, y, z);

    cubes[i].lookAt(new BABYLON.Vector3(0, 0, 0));
  }
  return cubes;
}

export const build = async ({scene}) => {
  const CD = scene.getTransformNodeByName('CDChassis');
  // Make sure the CD is rendered in front of everything else i.e. top layer
  // CD.getChildren().forEach((child) => (child.renderingGroupId = 1)); // eslint-disable-line no-return-assign
  // CD.renderingGroupId = 1
  const camera = scene.activeCamera;
  scene.clearColor = new BABYLON.Color3(0, 0, 0);

  const light = new BABYLON.PointLight('light1', new BABYLON.Vector3(0, 10, 0), scene);

  const light1 = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 10, 0), scene);
  light1.diffuseColor = new BABYLON.Color3(1, 1, 1);

  // const sphere = BABYLON.Mesh.CreateSphere('s', 32, 5, scene);
  // const sphere = await BABYLON.ParticleHelper.CreateAsync('sun', scene);
  // sphere.start();
  // console.log(sphere.emitterNode);

  const cubes = createCubesBall(1000, scene);

  // const mat_sphere = new BABYLON.StandardMaterial('s', scene);
  // sphere.material = mat_sphere;

  // const probe = new BABYLON.ReflectionProbe('probe', 512, scene);
  // probe.renderList.push(sphere);

  const cubesMat = new BABYLON.StandardMaterial('m', scene);

  cubes[0].material = cubesMat;

  const container = BABYLON.Mesh.CreateBox('cont', 110, scene);
  const matCont = new BABYLON.StandardMaterial('mc', scene);
  matCont.alpha = 0.1;
  container.material = matCont;

  let px = 0;
  let py = 0;
  let pz = 0;
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let t = 0.0;
  let tc = 0.0;
  let seed = 0;
  let updating = false;
  let sleeping = false;
  let wiggle = 1;

  // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
  var sphere = BABYLON.Mesh.CreateSphere('sphere1', 32, 25, scene);
  var fsphere = BABYLON.Mesh.CreateSphere('sphere1', 32, 25, scene);
  fsphere.isVisible = false;

  var mat = new BABYLON.StandardMaterial('mat', scene);
  mat.backFaceCulling = false;
  mat.alpha = 0.7;
  mat.diffuseColor = new BABYLON.Color3(0.4, 0.5, 0.7);
  mat.bumpTexture = new BABYLON.Texture('http://www.synergy-development.fr/equalonyzer/images/grained_uv.png', scene);
  mat.bumpTexture.uScale = 4;
  mat.bumpTexture.vScale = 4;
  mat.reflectionTexture = new BABYLON.Texture(
    'http://www.synergy-development.fr/equalonyzer/images/spheremap.jpg',
    scene,
  );
  mat.reflectionTexture.level = 0.6;
  mat.reflectionTexture.coordinatesMode = BABYLON.Texture.SPHERICAL_MODE;

  sphere.material = mat;

  var v = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  var fv = fsphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);

  let tw = 0;
  scene.registerBeforeRender(() => {
    // sin/cos random direction
    // if (!updating && !sleeping) {
    //   // seed = rnd(-0.1, 0.1);
    //   seed = 1;
    //   updating = true;
    //   setTimeout(() => {
    //     updating = false;
    //     sleeping = true;
    //     setTimeout(() => {
    //       sleeping = false;
    //     }, 1000);
    //   }, 1000);
    // }
    // if (updating && !sleeping) {
    px = 25.0 * Math.cos(t / 3.5);
    py = 25.0 + 10.0 * Math.sin(t / 4.0);
    pz = 25.0 * Math.cos(t / 4.5);
    // Make all cubes look at the moving sphere
    const point = new BABYLON.Vector3(px, py, pz);
    for (let i = 0; i < cubes.length; i++) {
      cubes[i].lookAt(point);
    }
    t += 0.1;
    // }
    // if (sleeping) {
    //   wiggle *= -1;
    //   px += wiggle * rnd(-1, 1);
    //   py += wiggle * rnd(-1, 1);
    //   pz += wiggle * rnd(-1, 1);
    //   const point = new BABYLON.Vector3(px, py, pz);
    //   for (let i = 0; i < cubes.length; i++) {
    //     cubes[i].lookAt(point);
    //   }
    // }

    // sin/cos random color between 0,1
    cr = 0.5 + 0.5 * Math.sin(tc / 12);
    cg = 0.5 + 0.5 * Math.sin(tc / 14);
    cb = 0.5 + 0.5 * Math.sin(tc / 16);
    tc += 0.4;

    // Change sphere and cubes colors
    // mat_sphere.diffuseColor = new BABYLON.Color3(cr, cg, cb);
    // mat_sphere.emissiveColor = new BABYLON.Color3(cr, cg, cb);
    cubesMat.diffuseColor = new BABYLON.Color3(cr, cg, cb);

    // Move our sphere
    // sphere.systems.forEach((system) => {
    //   system.translationPivot = new BABYLON.Vector3(px, py, pz);
    // });
    // sphere.emitterNode.position = new BABYLON.Vector3(px, py, pz);

    // camera.alpha = 4.0 * (Math.PI / 20 + Math.cos(t / 30));
    // camera.beta = 2.0 * (Math.PI / 20 + Math.sin(t / 50));
    // camera.radius = 180 + (-50 + 50 * Math.sin(t / 10));

    for (var i = 0; i < sphere.getTotalVertices(); i++) {
      var fx = fv[i * 3 + 0];
      var fy = fv[i * 3 + 1];
      var fz = fv[i * 3 + 2];

      v[i * 3 + 0] = fx + 0.33 * Math.sin(tw * 2.15 + fy) + Math.cos(tw * 1.45 + fz) + 1.5;
      v[i * 3 + 1] = fy + 0.36 * Math.cos(tw * 1.15 + fz) + Math.sin(tw * 1.45 + fx) + 1.5;
      v[i * 3 + 2] = fz + 0.39 * Math.sin(tw * 1.15 + fx) + Math.cos(tw * 1.45 + fy) + 1.5;
    }
    sphere.setVerticesData(BABYLON.VertexBuffer.PositionKind, v);

    tw += 0.01;
  });

  return scene;
};
