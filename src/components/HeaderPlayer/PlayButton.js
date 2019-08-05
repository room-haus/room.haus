import React, {useCallback} from 'react';
import styled, {css} from 'styled-components';
import PlaySVG from 'src/images/play.svg';
import PauseSVG from 'src/images/pause.svg';

const buttonUrl = ({playing}) => (playing ? PauseSVG : PlaySVG);

const PlayButtonWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  background-image: url(${buttonUrl});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;

  ${({highlight}) =>
    highlight &&
    css`
      @keyframes shadow-pulse {
        0% {
          box-shadow: 0 0 0 0px rgba(0, 0, 0, 0.2);
        }
        100% {
          box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
        }
      }

      animation: shadow-pulse 1s infinite;
    `};
`;

export default ({handleClick, playing, readyForPlayback}) => {
  const onClick = useCallback(handleClick, [handleClick]);
  return <PlayButtonWrapper highlight={!readyForPlayback} playing={playing} onClick={onClick} />;
};
