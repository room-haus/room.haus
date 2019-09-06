import React, {useRef, useEffect} from 'react';
import styled from 'styled-components';
import * as BABYLON from 'babylonjs';
import HLS from 'hls.js';

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene, audio}) => {
  const CD = scene.getMeshByName('CDChassis');
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

export const VideoBackgroundScene = ({manifestUrl}) => {
  const videoRef = useRef();

  useEffect(() => {
    const video = videoRef.current;
    let hls;
    if (HLS.isSupported()) {
      hls = new HLS();
      hls.loadSource(manifestUrl);
      hls.attachMedia(video);
    } else {
      video.src = manifestUrl;
    }

    return () => hls && hls.destroy();
  }, [manifestUrl]);

  return (
    <Container>
      <Video key="video" innerRef={videoRef} autoPlay loop muted playsinline />
    </Container>
  );
};
