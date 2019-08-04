import React, {useCallback} from 'react';
import styled from 'styled-components';
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
`;

export default ({handleClick, playing, loading}) => {
  const onClick = useCallback(handleClick, [handleClick]);
  return <PlayButtonWrapper playing={playing} onClick={onClick} loading={loading} />;
};
