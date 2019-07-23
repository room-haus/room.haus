import React, {useRef, useEffect} from 'react';
import styled from 'styled-components';
import useMix from './useMix';
import useSceneManager from './useSceneManager';
import useHLSAudio from '../../audio2/useHLSAudio';
import {useMixMetaContext} from './MixMetaContext';

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
  position: relative;
`;

const BackgroundContainer = styled.div`
  position: absolute;
  display: block;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
  padding: 0;
`;

export default ({mixId, sceneId}) => {
  const mainCanvasRef = useRef();
  const manager = useSceneManager(mainCanvasRef);
  const {setMixId, meta} = useMixMetaContext();
  const audio = useHLSAudio(meta.audioSourceURL);
  const Background = manager.background;

  useEffect(() => {
    console.log('Running scene', sceneId, mixId);
    setMixId(mixId);
    manager.runScene(sceneId, {audio});
  }, [sceneId, mixId]);

  return (
    <CanvasContainer>
      {Background && (
        <BackgroundContainer>
          <Background source={audio} />
        </BackgroundContainer>
      )}
      <Canvas innerRef={mainCanvasRef} />
    </CanvasContainer>
  );
};

// class SceneViewer extends React.Component {
//   canvas = React.createRef();
//   backgroundCanvas = React.createRef();

//   constructor(props) {
//     super(props);
//     this.sceneManager = new BabylonSceneManager();
//     const mix = getMix(props.scene);
//     if (mix && props.setter) {
//       props.setter(mix.id);
//     }
//     this.sceneManager.onReady = () => {
//       this.setState({ready: true});
//       setTimeout(() => this.setState({loaded: true}), 1000);
//     };
//     // props.onInit && props.onInit();
//     this.state = {Background: null, ready: false, loaded: false};
//   }

//   componentDidMount() {
//     const {scene} = this.props;
//     this.sceneManager.init(this.canvas.current);
//     this.sceneManager.runScene(scene);
//     this.setState({
//       Background: this.sceneManager.background,
//     });
//   }

//   componentDidUpdate(prevProps) {
//     const {source, scene, setter} = this.props;
//     this.sceneManager.audio = source;
//     const newScene = prevProps.scene !== scene;
//     if (!prevProps.scene || newScene) {
//       if (newScene && source && source.isPlaying()) {
//         const oldSource = prevProps.source;
//         if (oldSource) {
//           oldSource.pause();
//         }
//       }
//       this.sceneManager.runScene(scene);
//       this.setState({
//         Background: this.sceneManager.background,
//       });
//       const mix = getMix(scene);
//       if (mix) {
//         setter(mix.id);
//       }
//     }
//   }

//   componentWillUnmount() {
//     this.sceneManager.cleanUp();
//   }

//   render() {
//     const {Background, ready, loaded} = this.state;
//     const {source} = this.props;
//     return (
//       <>
//         {(!ready || !loaded) && <SplashScreen hide={ready} />}
//         <CanvasContainer>
//           {Background && (
//             <BackgroundContainer>
//               <Background source={source} />
//             </BackgroundContainer>
//           )}
//           <Canvas innerRef={this.canvas} />
//         </CanvasContainer>
//       </>
//     );
//   }
// }

// export default SceneViewer;
