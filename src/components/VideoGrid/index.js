import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import {randomInt, tileVideoCanvas, loadVideo, setVideoMatrix} from './helpers';
import HLSAudioSource from '../../audio/HLSAudioSource';

const Container = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const Video = styled.video`
  position: absolute;
  left: 0;
  top: 0;
  width: 50%;
  height: 100%;
`;

const Canvas = styled.canvas`
  box-sizing: border-box;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

class VideoGrid extends React.Component {
  static propTypes = {
    source: PropTypes.instanceOf(HLSAudioSource),
    videos: PropTypes.arrayOf(PropTypes.string).isRequired,
    columns: PropTypes.number,
    rows: PropTypes.number,
  };
  static defaultProps = {
    source: {},
    columns: 4,
    rows: 2,
  };
  constructor(props) {
    super(props);
    this.columns = props.columns;
    this.rows = props.rows;
    this.videos = props.videos.map((manifestUrl) => ({
      manifestUrl,
      ref: React.createRef(),
    }));
    this.canvasRef = React.createRef();
  }

  componentDidMount() {
    this.canvas = this.canvasRef.current;
    const {width, height} = this.canvas.getBoundingClientRect();
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.loadVideos();
    this.initGrid();

    const {source} = this.props;
    source.setOnsetCallback(() => this.updateGrid());
    this.animate();
  }

  getRandomVideo() {
    return this.videos[Math.floor(Math.random() * 2)];
  }

  initGrid() {
    // this.columns = randomInt(5, 20);
    this.videoMatrix = setVideoMatrix(this.videos, this.columns, this.rows);
  }

  updateGrid() {
    // if (Math.random() > 0.95) {
    //   this.initGrid();
    // } else {
    // const tiles = randomInt(2, 8);
    const tiles = 1;
    for (let i = 0; i < tiles; i++) {
      const x = randomInt(this.columns);
      const y = randomInt(this.rows);
      this.videoMatrix[y][x] = randomInt(this.videos.length);
    }
    // }
  }

  animate() {
    tileVideoCanvas(this.ctx, this.videos, this.canvas, this.videoMatrix);
    requestAnimationFrame(this.animate.bind(this));
  }

  loadVideos() {
    this.videos.forEach((video) => loadVideo(video));
  }

  render() {
    return (
      <Container>
        {this.videos.map(({ref, manifestUrl}) => (
          <Video key={manifestUrl} innerRef={ref} autoPlay loop muted />
        ))}
        <Canvas innerRef={this.canvasRef} autoPlay loop muted />
      </Container>
    );
  }
}

export default VideoGrid;
