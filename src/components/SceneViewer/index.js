import React, {useState, useRef, useEffect} from 'react';
import styled from 'styled-components';
import {useRouteMatch} from 'react-router-dom';
import useHLSAudio from 'src/audio/useHLSAudio';
import {mixes as mixList} from 'src/content/mixes';
import SceneViewLayout from 'src/components/layout/SceneViewLayout';
import {releases as releaseList} from 'src/content/releases';
import {getMix, getReleaseBySlug} from 'src/content';
import useSceneManager from './useSceneManager';
import {useContentMetaContext} from './ContentMetaContext';
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

const CatalogOverlay = ({show, contentType}) => {
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
  const content = contentType === 'mix' ? mixList : releaseList;
  return (
    <CatalogListOverlay show={show} visible={visible}>
      <CatalogList content={content} columns={5} density={2} />
    </CatalogListOverlay>
  );
};

const useURLAwareConfig = () => {
  const mixMatch = useRouteMatch('/mixes/');
  const releaseMatch = useRouteMatch('/releases/:slug?');
  if (mixMatch) {
    let mx = new URLSearchParams(window.location.search).get('mx');
    mx = getMix(mx);
    if (mx) {
      const {id} = mx;
      return {
        contentId: id,
        sceneId: id,
        contentType: 'mix',
      };
    }
    return {contentType: 'mix'};
  }
  if (releaseMatch) {
    const {slug} = releaseMatch.params;
    const release = getReleaseBySlug(slug);
    if (release) {
      const {id} = release;
      return {
        contentId: id,
        sceneId: id,
        contentType: 'release',
      };
    }
    return {
      contentType: 'release',
    };
  }
  return {};
};

export default () => {
  const mainCanvasRef = useRef();
  const manager = useSceneManager(mainCanvasRef);
  const {setContentId, streamURL} = useContentMetaContext({trackIndex: 0});
  const audio = useHLSAudio(streamURL);
  const Background = manager.background;
  const {contentId, contentType, sceneId} = useURLAwareConfig();
  const showCatalogOverlay = !contentId;

  useEffect(() => {
    if (contentId && sceneId) {
      setContentId(contentId);
      manager.runScene(sceneId, {audio});
    }
  }, [sceneId, contentId]);

  useEffect(() => {
    if (showCatalogOverlay && audio.isPlaying()) {
      audio.toggle();
    }
    if (!showCatalogOverlay && !audio.isPlaying()) {
      audio.toggle();
    }
  }, [showCatalogOverlay]);

  useEffect(() => {
    if (showCatalogOverlay) {
      /*
       * If the mix catalog overaly is showing on page load, the audio context
       * has not been set and needs to be resumed on any page click to allow seamless
       * audio playback on mix selection.
       * */
      document.addEventListener(
        'click',
        () => {
          audio.resume();
        },
        {once: true},
      );
    }
  }, []);

  return (
    <SceneViewLayout mixSceneMode={Boolean(contentId)} contentViewType={contentType}>
      <CatalogOverlay show={showCatalogOverlay} contentType={contentType} />
      <CanvasContainer>
        {Background && (
          <BackgroundContainer>
            <Background source={audio} />
          </BackgroundContainer>
        )}
        <Canvas innerRef={mainCanvasRef} />
      </CanvasContainer>
    </SceneViewLayout>
  );
};
