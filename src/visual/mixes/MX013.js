import React from 'react';
import styled from 'styled-components';
import * as BABYLON from 'babylonjs';
import CaseTexture from 'src/images/mix-art/mx013.jpg';
import CDLabelTexture from '../../images/cd_template_MX013.png';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
};

const Video = styled.video`
  width: 100%;
  height: 100%;
`;
const CanvasTile = styled.canvas`
  width: 100%;
  height: 100%;
`;

const Container = styled.div`
  margin: auto;
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
`;

export class Background extends React.Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.canvasRefs = [
      React.createRef(),
      React.createRef(),
      React.createRef(),
      React.createRef(),
      React.createRef(),
      React.createRef(),
      React.createRef(),
      React.createRef(),
    ];
  }

  componentDidMount() {
    this.video = this.videoRef.current;
    this.contexts = this.canvasRefs.map(({current}) => {
      const {width, height} = this.video.getBoundingClientRect();
      current.width = width;
      current.height = height;
      return current.getContext('2d');
    });
    this.video.addEventListener(
      'play',
      () => {
        this.updateCanvases();
      },
      false,
    );
    window.addEventListener('resize', () => {
      this.canvasRefs.forEach(({current}) => {
        if (!current) {
          return;
        }
        const {width, height} = this.video.getBoundingClientRect();
        current.width = width;
        current.height = height;
      });
    });
  }

  getAdjustedCanvasDimensions() {
    const {videoHeight, videoWidth} = this.video;
    const {width, height} = this.video.getBoundingClientRect();
    const dimensions = {
      vWidth: videoWidth,
      vHeight: videoHeight,
    };
    const ratio = width / videoWidth;
    dimensions.height = videoHeight * ratio;
    dimensions.width = videoWidth * ratio;
    dimensions.x = (width - dimensions.width) / 2;
    dimensions.y = (height - dimensions.height) / 2;
    return dimensions;
  }

  updateCanvases() {
    if (this.video.paused || this.video.ended) {
      return false;
    }
    this.contexts.forEach((context) => {
      const {x, y, width, height, vHeight, vWidth} = this.getAdjustedCanvasDimensions();
      // console.log(width, height, videoWidth, videoHeight);
      context.drawImage(this.video, 0, 0, vWidth, vHeight, x, y, width, height);
      // context.drawImage(this.video, x, y, width, height);
      // context.drawImage(this.video, x, y);
    });
    setTimeout(this.updateCanvases.bind(this), 20);
  }

  render() {
    const video = (
      <Video
        key="video"
        innerRef={this.videoRef}
        src="https://www.dropbox.com/s/sslop96edbf800p/mx013video.mp4?dl=1"
        autoPlay={true}
        type="video/mp4"
        loop
        muted
      />
    );
    const canvases = this.canvasRefs.map((ref, i) => <CanvasTile key={i} innerRef={this.canvasRefs[i]} />);
    return <Container>{[video, ...canvases]}</Container>;
  }
}
