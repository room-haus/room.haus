import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {useAudioContext} from 'src/audio/AudioSourceContext';
import Oscilliscope from 'src/audio/visualizations/Oscilliscope';
import {useMixMetaContext} from '../SceneViewer/MixMetaContext';
import PlayButton from './PlayButton';

const OscilliscopeContainer = styled.div`
  position: relative;
  vertical-align: middle;
  height: 100%;
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
  color: #262525;
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
  opacity: 0.1;
  background-color: ${({color}) => color || '#53ef8d'};
  width: ${(props) => Math.round(props.progress * 100)}%;
  border: none !important;
  pointer-events: none;
`;

const Controls = styled.div`
  flex-grow: 2;
  cursor: ${({loading}) => (loading ? 'wait' : 'pointer')};
  border: 1px solid rgba(19, 18, 20, 0.7);
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
    border-left: 1px solid rgba(19, 18, 20, 0.7);
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
    const x = event.clientX - rect.left;
    setPercentage(x / rect.width);
  });
  const onMouseLeave = useCallback(() => {
    setPercentage(null);
  });

  useEffect(() => {
    const element = ref.current;
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mouseleave', onMouseLeave);
    element.addEventListener('touchstart', onMouseMove);

    return () => {
      element.removeEventListener('mousemove', onMouseMove);
      element.removeEventListener('mouseleave', onMouseLeave);
      element.removeEventListener('touchstart', onMouseMove);
    };
  }, [ref.current]);

  return percentage;
};

const MediaMeta = () => {
  const {meta} = useMixMetaContext();
  return (
    <MediaMetaContainer>
      <MediaImage src={meta.art} />
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
  return (
    <Controls loading={!isAudioReady}>
      <PlayButton handleClick={() => isAudioReady && audio.toggle()} playing={isAudioPlaying} />
      <OscilliscopeContainer innerRef={oscRef} onClick={() => audio.setPlayhead(percentage)}>
        <Oscilliscope source={audio} />
        <PlayheadProgressBar progress={audio.percentCompletion()} color="#121212" />
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
  const updateFunc = useCallback(() => setTime(audio.currentTime()));
  useEffect(() => {
    setInterval(updateFunc, 250);

    return () => {
      clearInterval(updateFunc);
    };
  }, []);
  return (
    <Container>
      <MediaMeta />
      <AudioControls audio={audio} />
      <MediaTimestamp time={time} />
    </Container>
  );
};

// class HeaderPlayer extends React.Component {
//   state = {
//     percentage: null,
//   };
//   handlePlay = memoize((source, onPlay) => () => source.toggle() && onPlay());

//   handleTouch = (setPlayhead, event) => {
//     this.handleMouseMove(event);
//     const {percentage} = this.state;
//     setPlayhead(percentage);
//   };

//   handleMouseLeave = () => {
//     this.setState({percentage: null});
//   };

//   handleMouseMove = (event) => {
//     const rect = event.target.getBoundingClientRect();
//     const x = event.clientX - rect.left;
//     this.setState({percentage: x / rect.width});
//   };

//   render() {
//     return (
//       <AudioSourceContext.Consumer>
//         {({source}) =>
//           source && (
//             <AudioMetaContext.Consumer>
//               {({isLoading, isPlaying, isReady, meta, loadProgress}) => (
//                 <Container>
//                   {meta && (
//                     <MediaMetaContainer>
//                       <MediaImage src={meta.art} />
//                       <MediaMetaWrapper>
//                         <MediaTitle>{meta.artist}</MediaTitle>
//                         <MediaTitle>
//                           <i>{meta.name}</i>
//                         </MediaTitle>
//                         <CatalougeNumber>{meta.catalogueNumber}</CatalougeNumber>
//                       </MediaMetaWrapper>
//                     </MediaMetaContainer>
//                   )}
//                   <Controls loading={isLoading && !isReady}>
//                     <PlayButton
//                       handleClick={((!isLoading && !isReady) || isReady) && this.handlePlay(source, this.props.onPlay)}
//                       playing={isPlaying}
//                     />
//                     <OscilliscopeContainer
//                       onMouseMove={this.handleMouseMove}
//                       onMouseLeave={this.handleMouseLeave}
//                       onTouchStart={this.handleTouch.bind(this, () => source.setPlayhead)}
//                       onClick={() => source.setPlayhead(this.state.percentage)}>
//                       <Oscilliscope source={source} />
//                       {loadProgress < 1 && <ProgressBar progress={loadProgress} />}
//                       {source.ready && <PlayheadProgressBar progress={source.playheadLocation()} color="#121212" />}
//                     </OscilliscopeContainer>
//                   </Controls>
//                   <MediaTime>{formatTime(source.currentTime())}</MediaTime>
//                 </Container>
//               )}
//             </AudioMetaContext.Consumer>
//           )
//         }
//       </AudioSourceContext.Consumer>
//     );
//   }
// }

// export default HeaderPlayer;
