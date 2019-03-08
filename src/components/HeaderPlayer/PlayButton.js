import React from 'react';
import styled from 'styled-components';
import PlaySVG from '../../images/play.svg';
import PauseSVG from '../../images/pause.svg';

const buttonUrl = ({playing}) => (playing ? PauseSVG : PlaySVG);

const PlayButtonWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  background-image: url(${buttonUrl});
  background-position: center;
  background-repeat: no-repeat;
`;

class PlayButton extends React.Component {
  onClick = () => {
    this.props.handleClick && this.props.handleClick();
  };

  render() {
    return (
      <PlayButtonWrapper
        playing={this.props.playing}
        onClick={this.onClick}
        loading={this.props.loading}
      />
    );
  }
}

export default PlayButton;
