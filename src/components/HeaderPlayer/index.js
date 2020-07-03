import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {useAudioContext} from 'src/audio/AudioSourceContext';
import useIntervalCallback from 'src/components/hooks/useIntervalCallback';
import Oscilliscope from 'src/audio/visualizations/Oscilliscope';
import {useContentMetaContext} from '../SceneViewer/ContentMetaContext';
import PlayButton from './PlayButton';

const OscilliscopeContainer = styled.div`
  position: relative;
  vertical-align: middle;
  height: 100%;
  cursor: ${({disabled}) => (disabled ? 'wait' : 'pointer')};
  pointer-events: ${({disabled}) => (disabled ? 'none' : 'auto')};
`;

const Container = styled.div`
  box-sizing: border-box;
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-self: center;
  padding: 5px 10px;

  @media (max-width: 700px) {
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr auto;
  }
`;

const MediaTitle = styled.span`
  white-space: nowrap;
`;

const CatalougeNumber = styled.span`
  font-size: 0.7rem;
  font-weight: 900;
`;

const MediaTime = styled.span`
  font-size: 3.7vw;
  text-align: center;
  display: inline-block;
  flex-basis: content;
  width: 11vw;
  line-height: 1em;

  @media (max-width: 700px) {
    grid-row-start: 1;
    justify-self: end;
  }
`;

const MediaMetaContainer = styled.div`
  display: flex;
  flex-basis: content;
  align-items: center;
  justify-items: center;

  @media (max-width: 700px) {
    width: 100%;
    grid-row-start: 1;
    justify-self: start;
    padding-right: 10%;

    & span {
      font-size: 0.7em;
      font-weight: 900;
    }
  }
`;

const MediaMetaWrapper = styled.div`
  /* color: #262525; */
  font-size: 1em;
  line-height: 1em;
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  position: relative;
  font-family: 'NeueHaasGrotDisp';
  height: 80%;
  justify-content: space-between;
  margin: 0 0 0 1vw;

  @media (max-width: 700px) {
    flex-direction: row;
    width: 100%;
    margin: 0;
  }
`;

const MediaImage = styled.img`
  object-fit: contain;
  max-height: 65px;
  max-width: 100px;
  position: relative;
  user-drag: none;
  vertical-align: middle;
  display: inline-block;
  margin: 0;

  @media (max-width: 700px) {
    display: none;
  }
`;

const PlayheadProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  top: 0;
  opacity: 0.2;
  background-color: ${({color}) => color || '#53ef8d'};
  width: ${(props) => Math.round(props.progress * 100)}%;
  border: none !important;
  pointer-events: none;
`;

const color = 'rgba(245, 245, 245, 0.7)';
const Controls = styled.div`
  flex-grow: 2;
  cursor: pointer;
  /* border: 1px solid rgba(19, 18, 20, 0.7); */
  border: 1px solid ${color};
  display: grid;
  grid-template-columns: minmax(45px, 1fr) 8fr;
  grid-template-rows: minmax(3em, 5vh);
  margin: 0 2vw 0 3vw;

  @media (max-width: 700px) {
    grid-row-start: 2;
    grid-column-start: span 2;
    margin: 0;
    grid-template-rows: 5vh;
  }

  * + * {
    border-left: 1px solid ${color};
  }
`;

const formatTime = (time) => {
  if (!time) {
    return '00:00';
  }
  const minutes = String(Math.floor(time / 60)).padStart(2, '0');
  const seconds = String(Math.round(time % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const useMousePerc = (ref) => {
  const [percentage, setPercentage] = useState();
  const onMouseMove = useCallback((event) => {
    const rect = event.target.getBoundingClientRect();
    const {clientX} = event.touches ? event.touches[0] : event;
    const x = clientX - rect.left;
    setPercentage(x / rect.width);
  });
  const onMouseLeave = useCallback(() => {
    setPercentage(null);
  });

  useEffect(() => {
    const element = ref.current;
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseleave', onMouseLeave);
    // element.addEventListener('touchstart', onMouseMove);

    return () => {
      element.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mouseleave', onMouseLeave);
      // element.removeEventListener('touchstart', onMouseMove);
    };
  }, [ref.current]);

  return percentage;
};

const MediaMeta = () => {
  const {meta} = useContentMetaContext();
  return (
    <MediaMetaContainer>
      {meta.purchaseLink ? (
        <a target="_blank" rel="noopener noreferrer" href={meta.purchaseLink}>
          <MediaImage src={meta.art} />
        </a>
      ) : (
        <MediaImage src={meta.art} />
      )}
      <MediaMetaWrapper>
        <MediaTitle>{meta.artist}</MediaTitle>
        <MediaTitle>
          <i>{meta.name}</i>
        </MediaTitle>
        <CatalougeNumber>{meta.catalogueNumber}</CatalougeNumber>
      </MediaMetaWrapper>
    </MediaMetaContainer>
  );
};

const AudioControls = ({audio}) => {
  const isAudioReady = audio.ready;
  const isAudioPlaying = audio.isPlaying();
  const oscRef = useRef();
  const percentage = useMousePerc(oscRef);
  const callback = useCallback(() => {
    if (isAudioReady) {
      audio.toggle();
    } else {
      audio.resume();
    }
  }, [isAudioReady]);
  const setPercentage = useCallback(() => audio.setPlayhead(percentage));
  return (
    <Controls>
      <PlayButton handleClick={callback} playing={isAudioPlaying} readyForPlayback={isAudioReady} />
      <OscilliscopeContainer innerRef={oscRef} onClick={setPercentage} disabled={!isAudioReady}>
        <Oscilliscope source={audio} />
        <PlayheadProgressBar progress={audio.percentCompletion()} color="#FFF" />
      </OscilliscopeContainer>
    </Controls>
  );
};

const MediaTimestamp = ({time}) => {
  return <MediaTime>{formatTime(time)}</MediaTime>;
};

export default () => {
  const {audio} = useAudioContext();
  const [time, setTime] = useState(audio.currentTime());
  useIntervalCallback(() => setTime(audio.currentTime()), [audio], 250);

  return (
    <Container>
      <MediaMeta />
      <AudioControls audio={audio} />
      <MediaTimestamp time={time} />
    </Container>
  );
};
