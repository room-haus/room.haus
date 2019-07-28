import React from 'react';
import styled from 'styled-components';
import * as BABYLON from 'babylonjs';
import HLS from 'hls.js';
import CaseTexture from '../../images/mix-art/mx035.jpg';
import CDLabelTexture from '../../images/cd_template_MX030.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

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
