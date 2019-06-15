import React from 'react';
import styled from 'styled-components';
import * as BABYLON from 'babylonjs';
import HLS from 'hls.js';
import CaseTexture from '../../images/mx035.jpg';
import CDLabelTexture from '../../images/cd_template_MX030.png';

const random = (min, max) => {
  if (max === undefined) {
    return Math.random() * min;
  }
  return Math.random() * (max - min) + min;
};

const randColor = (colors) => {
  const {length} = colors;
  const index = Math.abs(Math.round(random(length - 1)));
  return colors[index];
};

const sceneColors = [
  new BABYLON.Color4(116 / 255, 63 / 255, 123 / 255, 1),
  new BABYLON.Color4(144 / 255, 197 / 255, 79 / 255, 1),
  new BABYLON.Color4(231 / 255, 140 / 255, 68 / 255, 1),
];

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

const makeParticles = (scene, mesh, particleCount) => {
  const factor = 100; // particle system size
  const myPositionFunction = (particle) => {
    const offset = 1;
    particle.position.x = (Math.random() - 0.5) * factor;
    particle.position.y = (Math.random() - 0.5) * factor;
    particle.position.z = (Math.random() - 0.5) * factor;
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
    particle.color = randColor(sceneColors);
  };
  const SPS = new BABYLON.SolidParticleSystem('SPS', scene, {updatable: true});
  SPS.addShape(mesh, particleCount, {positionFunction: myPositionFunction});
  SPS.initParticles = () => {
    SPS.particles.forEach((particle) => {
      particle.rotationX = Math.random() * 0.01 - 0.005;
      particle.rotationY = Math.random() * 0.01 - 0.005;
      particle.rotationZ = Math.random() * 0.01 - 0.005;
    });
  };
  SPS.updateParticle = (particle) => {
    particle.rotation.x += particle.rotationX;
    particle.rotation.y += particle.rotationY;
    particle.rotation.z += particle.rotationZ;
  };
  SPS.buildMesh();
  SPS.initParticles();
  SPS.setParticles();
  const rand = (max) => Math.random() * max - max / 2;
  const rotation = new BABYLON.Vector3(rand(0.0005), rand(0.0005), rand(0.0005));
  scene.registerBeforeRender(() => {
    SPS.setParticles();
    SPS.mesh.rotation.addInPlace(rotation);
  });
};

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, audio}) => {
  const CD = scene.getMeshByName('CDChassis');
  const cdLabel = scene.getMeshByName('CDLabel');
  cdLabel.position.addInPlace(new BABYLON.Vector3(-0.5, -0.3, 0));
  // Make sure the CD is rendered in front of everything else i.e. top layer
  CD.getChildren().forEach((child) => (child.renderingGroupId = 1)); // eslint-disable-line
  scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 0);

  const color = new BABYLON.Color3(240 / 255, 230 / 255, 194 / 255);
  const top = new BABYLON.HemisphericLight('topLight', new BABYLON.Vector3(0, 5, 0), scene);
  top.diffuse = color;
  top.intensity = 1.0;

  const intensity = 0.5;
  const bottom = new BABYLON.HemisphericLight('bottomLight', new BABYLON.Vector3(0, -5, 0), scene);
  bottom.diffuse = color;
  bottom.intensity = intensity;

  const left = new BABYLON.HemisphericLight('leftLight', new BABYLON.Vector3(-5, 0, 0), scene);
  left.diffuse = color;
  left.intensity = intensity;

  const right = new BABYLON.HemisphericLight('bottomLight', new BABYLON.Vector3(5, 0, 0), scene);
  right.diffuse = color;
  right.intensity = intensity;

  const front = new BABYLON.DirectionalLight('frontLight', new BABYLON.Vector3(0, 0, -1), scene);
  front.diffuse = color;
  front.intensity = intensity;

  // model : triangle
  const meshA = BABYLON.Mesh.CreateSphere('sphere', 4, 1, scene, true);
  const meshB = BABYLON.Mesh.CreatePlane('plane', 1, scene, true);

  // makeParticles(scene, sphere, 1000);
  makeParticles(scene, meshA, 1000);
  makeParticles(scene, meshB, 1000);
  meshA.dispose();
  meshB.dispose();

  const camera = scene.activeCamera;

  const horizontalBlur = new BABYLON.BlurPostProcess('blurrrr', new BABYLON.Vector2(1.0, 0), 0, 0.75, camera);
  const kernelDelta = 5;
  const kernelMax = 50;
  let blurOn = true;
  audio.makeBand('low', {
    lowPass: 120,
    highPass: 90,
  });
  scene.registerBeforeRender(() => {
    // pl.position = scene.activeCamera.position;
    if (blurOn) {
      if (horizontalBlur.kernel < kernelMax) {
        horizontalBlur.kernel += kernelDelta;
      }
    } else if (horizontalBlur.kernel > 0) {
      horizontalBlur.kernel -= kernelDelta;
    } else {
      horizontalBlur.kernel = 0;
    }
    horizontalBlur.updateEffect();
    const amp = audio.getAverageAmplitude('low');
    blurOn = amp > 128;
    // scene.clearColor = new BABYLON.Color4(energy, energy, energy, 1);
  });

  return scene;
};

const Container = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const Video = styled.video`
  min-width: 100%;
  min-height: 100%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;
export class Background extends React.Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
  }

  componentDidMount() {
    this.video = this.videoRef.current;
    const manifestUrl = 'https://roomhauscdnprd.blob.core.windows.net/assets/MX035/video/lava.m3u8';

    if (HLS.isSupported()) {
      this.hls && this.hls.destroy();
      this.hls = new HLS();
      this.hls.loadSource(manifestUrl);
      this.hls.attachMedia(this.video);
    } else {
      this.video.src = manifestUrl;
    }
  }

  render() {
    return (
      <Container>
        <Video
          key="video"
          innerRef={this.videoRef}
          autoPlay
          // type="video/mp4"
          loop
          muted
        />
      </Container>
    );
  }
}
