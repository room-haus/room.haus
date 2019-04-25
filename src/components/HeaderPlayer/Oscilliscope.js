import React, {useContext, useState, useEffect, useRef} from 'react';
import styled from 'styled-components';
import Oscilliscope from '../../audio/visualizations/Oscilliscope';
import AudioMetaContext from '../contexts/audio/AudioMetaContext';

const OscilliscopeContainer = styled.div`
  position: relative;
  vertical-align: middle;
  height: 100%;
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

function useMouseHorizontalPercentage(elem) {
  const [percentage, setPercentage] = useState(0);

  function handleMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setPercentage(x / rect.width);
  }

  useEffect(() => {
    elem.addEventListener('mousemove', handleMouseMove);
    elem.addEventListener('touchstart', handleMouseMove);

    return () => {
      elem.removeEventListener('mousemove', handleMouseMove);
      elem.removeEventListener('touchstart', handleMouseMove);
    };
  }, []);

  return percentage;
}

export const PlayerOscilliscope = (props) => {
  const ref = useRef(null);
  const {source} = props;
  const {loadProgress, isReady, playheadLocation} = useContext(AudioMetaContext);
  const percentage = ref ? useMouseHorizontalPercentage(ref.current) : 0;
  return (
    <OscilliscopeContainer ref={ref} onClick={() => source.setPlayhead(percentage)}>
      <Oscilliscope source={source} />
      {loadProgress < 1 && <ProgressBar progress={loadProgress} />}
      {isReady && <PlayheadProgressBar progress={playheadLocation} color="#121212" />}
    </OscilliscopeContainer>
  );
};

export default PlayerOscilliscope;
