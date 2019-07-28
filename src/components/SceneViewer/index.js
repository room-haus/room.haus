import React, {useState, useRef, useEffect} from 'react';
import styled from 'styled-components';
import useHLSAudio from 'src/audio/useHLSAudio';
import useSceneManager from './useSceneManager';
import {useMixMetaContext} from './MixMetaContext';
import CatalogList from '../MixCatalog/CatalogList';

const CanvasContainer = styled.div`
  position: relative;
  background-color: #404040;
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
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

const CatalogListOverlay = styled.div`
  background: #f5f6f6;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  z-index: 3;
  opacity: ${({show}) => (show ? 1 : 0)};
  transition: opacity 0.35s ease-in;
  visibility: ${({visible}) => (visible ? 'visible' : 'hidden')};
`;

const CatalogOverlay = ({show}) => {
  const [visible, setVisible] = useState(show);
  useEffect(() => {
    setVisible(show);
  }, []);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        setVisible(show);
      }, 350);
    } else {
      setVisible(show);
    }
  }, [show]);
  return (
    <CatalogListOverlay show={show} visible={visible}>
      <CatalogList />
    </CatalogListOverlay>
  );
};

export default ({mixId, sceneId, showCatalogOverlay}) => {
  const mainCanvasRef = useRef();
  const manager = useSceneManager(mainCanvasRef);
  const {setMixId, meta} = useMixMetaContext();
  const audio = useHLSAudio(meta.audioSourceURL);
  const Background = manager.background;

  useEffect(() => {
    if (mixId && sceneId) {
      setMixId(mixId);
      manager.runScene(sceneId, {audio});
    }
  }, [sceneId, mixId]);

  return (
    <>
      <CatalogOverlay show={showCatalogOverlay} />
      <CanvasContainer>
        {Background && (
          <BackgroundContainer>
            <Background source={audio} />
          </BackgroundContainer>
        )}
        <Canvas innerRef={mainCanvasRef} />
      </CanvasContainer>
    </>
  );
};
