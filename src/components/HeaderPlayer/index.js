import React from 'react';
import styled from 'styled-components';
import {memoize} from 'lodash';
import AudioSourceContext from '../contexts/audio/AudioSourceContext';
import AudioMetaContext from '../contexts/audio/AudioMetaContext';
import Oscilliscope from '../../audio/visualizations/Oscilliscope';
import PlayButton from './PlayButton';

const OscilliscopeContainer = styled.div`
  position: relative;
  vertical-align: middle;
  height: 100%;
`;

const Container = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-self: center;
`;

const MediaTitle = styled.span`
  overflow: hidden;
  white-space: nowrap;
`;

const CatalougeNumber = styled.span`
  font-size: 0.7rem;
  font-weight: 900;
`;

const MediaTime = styled.span`
  flex: 1;
  font-size: 1em;
  text-align: center;
  max-width: 75px;
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
  flex: 2;
`;

const MediaMetaContainer = styled.div`
  flex: 2;
  display: flex;
  align-items: center;
  justify-items: center;
  justify-content: space-between;

  @media (max-width: 700px) {
    margin-left: 1em;
  }
`;

const MediaImage = styled.img`
  object-fit: contain;
  max-height: 65px;
  max-width: 100px;
  flex: 1;
  position: relative;
  flex-shrink: 0;
  user-drag: none;
  vertical-align: middle;
  display: inline-block;
  margin: 0;

  @media (max-width: 700px) {
    display: none;
  }
`;

const ProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  opacity: 0.7;
  background-color: ${({color}) => color || '#53ef8d'};
  width: ${(props) => Math.round(props.progress * 100)}%;
  height: 0.3em;
  border: none !important;
  pointer-events: none;
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
  cursor: ${({loading}) => (loading ? 'wait' : 'pointer')};
  border: 1px solid rgba(19, 18, 20, 0.7);
  display: grid;
  grid-template-columns: 1fr 8fr;
  grid-template-rows: 1.8em;
  flex: 1;

  @media (max-width: 700px) {
    flex: 2;
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

class HeaderPlayer extends React.Component {
  state = {
    percentage: null,
  };
  handlePlay = memoize((source, onPlay) => () => source.toggle() && onPlay());

  handleTouch = (setPlayhead, event) => {
    this.handleMouseMove(event);
    const {percentage} = this.state;
    setPlayhead(percentage);
  };

  handleMouseLeave = () => {
    this.setState({percentage: null});
  };

  handleMouseMove = (event) => {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.setState({percentage: x / rect.width});
  };

  render() {
    return (
      <AudioSourceContext.Consumer>
        {({source}) =>
          source && (
            <AudioMetaContext.Consumer>
              {({isLoading, isPlaying, isReady, meta, loadProgress}) => (
                <Container>
                  <Controls loading={isLoading && !isReady}>
                    <PlayButton
                      handleClick={((!isLoading && !isReady) || isReady) && this.handlePlay(source, this.props.onPlay)}
                      playing={isPlaying}
                    />
                    <OscilliscopeContainer
                      onMouseMove={this.handleMouseMove}
                      onMouseLeave={this.handleMouseLeave}
                      onTouchStart={this.handleTouch.bind(this, () => source.setPlayhead)}
                      onClick={() => source.setPlayhead(this.state.percentage)}>
                      <Oscilliscope source={source} />
                      {loadProgress < 1 && <ProgressBar progress={loadProgress} />}
                      {source.ready && <PlayheadProgressBar progress={source.playheadLocation()} color="#121212" />}
                    </OscilliscopeContainer>
                  </Controls>
                  {meta && (
                    <MediaMetaContainer>
                      <MediaTime>{formatTime(source.currentTime())}</MediaTime>
                      <MediaImage src={meta.art} />
                      <MediaMetaWrapper>
                        <MediaTitle>{meta.artist}</MediaTitle>
                        <MediaTitle>
                          <i>{meta.name}</i>
                        </MediaTitle>
                        <CatalougeNumber>{meta.catalogueNumber}</CatalougeNumber>
                      </MediaMetaWrapper>
                    </MediaMetaContainer>
                  )}
                </Container>
              )}
            </AudioMetaContext.Consumer>
          )
        }
      </AudioSourceContext.Consumer>
    );
  }
}

export default HeaderPlayer;
