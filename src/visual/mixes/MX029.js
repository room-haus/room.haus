import React from 'react';
import * as BABYLON from 'babylonjs';
import HLS from 'hls.js';
import VideoGrid from '../../components/VideoGrid';
import CaseTexture from '../../images/mx029.jpg';
import CDLabelTexture from '../../images/cd_template_MX029.png';
// import {withPrefix} from 'gatsby';
// import {makeSkybox} from '../../utils/BabylonHelpers';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene, audio, engine}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
  // makeSkybox(scene, withPrefix('skyboxes/space/blue/blue'));

  const urls = [
    // 'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/water.m3u8',
    'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/orange_particles.m3u8',
    // 'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/blue_particles.m3u8',
  ];

  const vids = urls.map((url) => {
    const vid = document.createElement('video');
    const hls = new HLS();
    hls.loadSource(url);
    hls.attachMedia(vid);
    // vid.play();
    return vid;
  });
  const pl = new BABYLON.PointLight('pl', new BABYLON.Vector3(0, 0, 0), scene);
  pl.diffuse = new BABYLON.Color3(1, 1, 1);
  pl.intensity = 1.0;

  const nb = 3000; // nb of triangles
  const fact = 100; // cube size

  // custom position function for SPS creation
  const myPositionFunction = (particle) => {
    const offset = 1;
    particle.position.x = (Math.random() - 0.5) * fact;
    particle.position.y = (Math.random() - 0.5) * fact;
    particle.position.z = (Math.random() - 0.5) * fact;
    if (
      Math.abs(particle.position.x) < offset &&
      Math.abs(particle.position.y) < offset &&
      Math.abs(particle.position.z) < offset
    ) {
      let move = offset - Math.abs(particle.position.x);
      particle.position.x += particle.position.x > 0 ? move : -move;
      move = offset - Math.abs(particle.position.y);
      particle.position.y += particle.position.y > 0 ? move : -move;
      move = offset - Math.abs(particle.position.z);
      particle.position.z += particle.position.z > 0 ? move : -move;
    }
    particle.rotation.x = Math.random() * 3.15;
    particle.rotation.y = Math.random() * 3.15;
    particle.rotation.z = Math.random() * 1.5;
    particle.color = new BABYLON.Color4(1, 1, 1, 1);
  };

  // model : triangle
  const vid = vids[0];
  const box = BABYLON.Mesh.CreateBox('box', 1, scene, true);
  const mat = new BABYLON.StandardMaterial('mat', scene);
  const videoTexture = new BABYLON.VideoTexture('video', vid, scene, true, true);
  mat.diffuseTexture = videoTexture;
  audio.callbacks.onPlay = () => videoTexture.video.play();
  audio.callbacks.onPause = () => videoTexture.video.pause();

  const SPS = new BABYLON.SolidParticleSystem('SPS', scene, {updatable: true});
  SPS.addShape(box, nb, {positionFunction: myPositionFunction});
  SPS.initParticles = () => {
    SPS.particles.forEach((particle) => {
      particle.rotationX = Math.random() * 0.01 - 0.005;
      particle.rotationY = Math.random() * 0.01 - 0.005;
      particle.rotationZ = Math.random() * 0.01 - 0.005;
    });
  };
  SPS.updateParticle = (particle) => {
    particle.rotation.x += particle.rotationX || 0;
    particle.rotation.y += particle.rotationY || 0;
    particle.rotation.z += particle.rotationZ || 0;
  };
  SPS.buildMesh();
  SPS.mesh.material = mat;
  SPS.initParticles();
  SPS.setParticles();

  // dispose the model
  box.dispose();
  const rand = (max) => Math.random() * max - max / 2;
  const rotation = new BABYLON.Vector3(rand(0.0005), rand(0.0005), rand(0.0005));

  scene.registerBeforeRender(() => {
    SPS.setParticles();
    pl.position = scene.activeCamera.position;
    SPS.mesh.rotation.addInPlace(rotation);
    // const energy = audio ? audio.getTotalEnergy() : 0;
    // scene.clearColor = new BABYLON.Color4(energy, energy, energy, 0);
  });

  return scene;
};

export const Background = (props) => (
  <VideoGrid
    {...props}
    columns={2}
    rows={2}
    videos={[
      'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/blue_particles.m3u8',
      'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/blue.m3u8',
      'https://roomhauscdnprd.blob.core.windows.net/mixes/MX029/video/clouds.m3u8',
    ]}
  />
);
