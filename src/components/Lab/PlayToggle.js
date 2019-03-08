import React from 'react';
import styled from 'styled-components';

const Button = styled.button`
  width: 100%;
  height: 100%;
  display: block;
`;

const PlayToggle = ({source, className}) => {
  return (
    <Button className={className} onClick={source && source.toggle.bind(source)}>
      {source && source.isPlaying() ? 'PAUSE' : 'PLAY'}
    </Button>
  );
};

export default PlayToggle;
