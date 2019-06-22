import * as BABYLON from 'babylonjs';
import 'babylonjs-procedural-textures';
import CaseTexture from 'src/images/mix-art/mx012.jpg';
import CDLabelTexture from '../../images/cd_template_MX012.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene, engine, audio}) => {
  const camera = scene.activeCamera;
  const CD = scene.getMeshByName('CDChassis');
  // Make sure the CD is rendered in front of everything else i.e. top layer
  CD.getChildren().forEach((child) => (child.renderingGroupId = 1));

  const light = new BABYLON.HemisphericLight(
    'light',
    new BABYLON.Vector3(0, 1, 0),
    scene,
  );
  light.intensity = 10;

  // fire material
  var fireMaterial = new BABYLON.StandardMaterial('fireMaterial', scene);
  var fireTexture = new BABYLON.FireProceduralTexture('fire', 256, scene);
  fireTexture.level = 2;
  fireTexture.vScale = 0.5;
  fireMaterial.diffuseColor = new BABYLON.Color3(
    Math.random() / 2,
    Math.random() / 2,
    Math.random() / 2,
  );
  fireMaterial.diffuseTexture = fireTexture;
  fireMaterial.alpha = 1;
  fireMaterial.specularTexture = fireTexture;
  fireMaterial.emissiveTexture = fireTexture;
  fireMaterial.specularPower = 4;
  fireMaterial.backFaceCulling = false;
  fireTexture.fireColors = [
    BABYLON.Color3.FromHexString('#2f35cb'),
    BABYLON.Color3.White(),
    BABYLON.Color3.FromHexString('#2f35cb'),
    BABYLON.Color3.FromHexString('#2f35cb'),
    BABYLON.Color3.FromHexString('#2f35cb'),
    BABYLON.Color3.White(),
  ];

  // initial vars
  var delay = 1000;
  var steps = Math.floor(delay / 80);

  var paths = [];
  var targetPaths = [];
  var m = [1, 3, 1, 5, 1, 7, 1, 9];
  var lat = 50;
  var lng = 50;
  var deltas = [];
  var morph = false;
  var counter = 0;
  var rx = 0.0;
  var ry = 0.0;
  var deltarx = Math.random() / 200;
  var deltary = Math.random() / 400;

  // harmonic function : populates paths array according to m array
  var harmonic = function(m, lat, long, paths) {
    var pi = Math.PI;
    var pi2 = Math.PI * 2;
    var steplat = pi / lat;
    var steplon = pi2 / long;
    var index = 0;
    for (var theta = 0; theta <= pi2; theta += steplon) {
      var path = [];
      for (var phi = 0; phi <= pi; phi += steplat) {
        var r = 0;
        r += Math.pow(Math.sin(Math.floor(m[0]) * phi), Math.floor(m[1]));
        r += Math.pow(Math.cos(Math.floor(m[2]) * phi), Math.floor(m[3]));
        r += Math.pow(Math.sin(Math.floor(m[4]) * theta), Math.floor(m[5]));
        r += Math.pow(Math.cos(Math.floor(m[6]) * theta), Math.floor(m[7]));
        var p = new BABYLON.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        );
        path.push(p);
      }
      paths[index] = path;
      index++;
    }
  };

  // new SH function : fill targetPaths and delta arrays with Vector3 and colors
  var newSH = function(m, paths, targetPaths, deltas) {
    morph = true;
    var scl = 1 / steps;
    // new harmonic
    for (var i = 0; i < m.length; i++) {
      var rand = parseInt(Math.random() * 10);
      m[i] = rand;
    }
    harmonic(m, lat, lng, targetPaths);
    // deltas computation
    var index = 0;
    for (var p = 0; p < targetPaths.length; p++) {
      var targetPath = targetPaths[p];
      var path = paths[p];
      for (var k = 0; k < targetPath.length; k++) {
        deltas[index] = targetPath[k].subtract(path[k]).scale(scl);
        index++;
      }
    }
    // new rotation speeds
    deltarx = Math.random() / 200;
    deltary = Math.random() / 400;
  };

  // morphing function : update ribbons with intermediate m values
  var morphing = function(mesh, m, paths, targetPaths, deltas) {
    if (counter === steps) {
      counter = 0;
      morph = false;
      paths = targetPaths;
    } else {
      // update paths
      var index = 0;
      for (var p = 0; p < paths.length; p++) {
        var path = paths[p];
        for (var j = 0; j < path.length; j++) {
          path[j] = path[j].add(deltas[index]);
          index++;
        }
      }
      mesh = BABYLON.Mesh.CreateRibbon(
        null,
        paths,
        null,
        null,
        null,
        scene,
        null,
        null,
        mesh,
      );
    }
    counter++;
    return mesh;
  };

  // SH init & ribbon creation
  harmonic(m, lat, lng, paths);
  var mesh = BABYLON.Mesh.CreateRibbon(
    'ribbon',
    paths,
    true,
    false,
    0,
    scene,
    true,
  );
  mesh.freezeNormals();
  mesh.scaling = new BABYLON.Vector3(1, 1, 1);
  mesh.material = fireMaterial;
  // Volumetric Light
  var volLight = new BABYLON.VolumetricLightScatteringPostProcess(
    'vl',
    1.0,
    camera,
    mesh,
    50,
    BABYLON.Texture.BILINEAR_SAMPLINGMODE,
    engine,
    false,
  );
  volLight.exposure = 0.15;
  volLight.decay = 0.95;
  volLight.weight = 0.5;

  // interval setting
  var triggerMorph = () => {
    newSH(m, paths, targetPaths, deltas);
    mesh = morphing(mesh, m, paths, targetPaths, deltas);
  };

  audio.makeBand('kick', {
    lowPass: 120,
    highPass: 90,
    threshold: 100,
    callback: () => {
      triggerMorph();
    },
  });

  // immediate first SH
  newSH(m, paths, targetPaths, deltas);

  scene.registerBeforeRender(() => {
    if (morph) {
      mesh = morphing(mesh, m, paths, targetPaths, deltas);
    }
    rx += deltarx;
    ry -= deltary;
    mesh.rotation.y = ry;
    mesh.rotation.z = rx;
  });

  // scene.onDispose = function() {
  //   clearInterval(interval);
  // };

  return scene;
};
