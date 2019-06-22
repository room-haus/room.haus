import React from 'react';
import * as BABYLON from 'babylonjs';
import HLS from 'hls.js';
import styled from 'styled-components';
import CaseTexture from 'src/images/mix-art/mx020.jpg';
import CDLabelTexture from '../../images/cd_template_MX020.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight(
    'light',
    new BABYLON.Vector3(0, 1, 0),
    scene,
  );
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
  // scene.clearColor = new BABYLON.Color3(0.5, 0.5, 0.5);

  // console.log(scene.meshes.map((mesh) => mesh.name));

  // const headMesh = scene.getMeshByName('default');
  // headMesh.createNormals(true);
  // // headMesh.applyDisplacementMap(DisplacementMap, 0, 0.5);
  // headMesh.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
  // headMesh.position = new BABYLON.Vector3(0, -0.5, 0);
  // const CD = scene.getMeshByName('CDChassis');
  // CD.getChildren().forEach((child) => (child.renderingGroupId = 1));

  // return scene;
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
    const manifestUrl = `https://roomhauscdnprd.blob.core.windows.net/assets/MX020BGV/MX020BGV.m3u8`;

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
          autoPlay={true}
          // type="video/mp4"
          loop
          muted
        />
      </Container>
    );
  }
}
