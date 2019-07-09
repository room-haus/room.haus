import React from 'react';
import styled from 'styled-components';
import BabylonSceneManager from '../../visual/BabylonSceneManager';
import SplashScreen from '../SplashScreen';
import {getMix} from '../../content/mixes';

const CanvasContainer = styled.div`
  position: relative;
  background-color: #404040;
  margin: 0;
  padding: 0;
  height: 100%;
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
`;

const BackgroundContainer = styled.div`
  display: block;
  width: 100%;
  height: 100%;
  margin: auto;
  padding: 0;
`;

class SceneViewer extends React.Component {
  canvas = React.createRef();
  backgroundCanvas = React.createRef();

  constructor(props) {
    super(props);
    this.sceneManager = new BabylonSceneManager();
    const mix = getMix(props.scene);
    if (mix && props.setter) {
      props.setter(mix.id);
    }
    this.sceneManager.onReady = () => {
      this.setState({ready: true});
      setTimeout(() => this.setState({loaded: true}), 1000);
    };
    // props.onInit && props.onInit();
    this.state = {Background: null, ready: false, loaded: false};
  }

  componentDidMount() {
    const {scene} = this.props;
    this.sceneManager.init(this.canvas.current);
    this.sceneManager.runScene(scene);
    this.setState({
      Background: this.sceneManager.background,
    });
  }

  componentDidUpdate(prevProps) {
    const {source, scene, setter} = this.props;
    this.sceneManager.audio = source;
    // if (!prevProps.source || prevProps.source !== source) {
    //   source.init();
    //   this.sceneManager.audio = source;
    //   this.sceneManager.runScene(scene);
    //   this.setState({
    //     Background: this.sceneManager.background,
    //   });
    // }
    const newScene = prevProps.scene !== scene;
    if (!prevProps.scene || newScene) {
      if (newScene && source && source.isPlaying()) {
        const oldSource = prevProps.source;
        if (oldSource) {
          oldSource.pause();
        }
      }
      this.sceneManager.runScene(scene);
      this.setState({
        Background: this.sceneManager.background,
      });
      const mix = getMix(scene);
      if (mix) {
        setter(mix.id);
      }
    }
  }

  componentWillUnmount() {
    this.sceneManager.cleanUp();
  }

  render() {
    const {Background, ready, loaded} = this.state;
    const {source} = this.props;
    return (
      <>
        {(!ready || !loaded) && <SplashScreen hide={ready} />}
        <CanvasContainer>
          {Background && (
            <BackgroundContainer>
              <Background source={source} />
            </BackgroundContainer>
          )}
          <Canvas innerRef={this.canvas} />
        </CanvasContainer>
      </>
    );
  }
}

export default SceneViewer;
