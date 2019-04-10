import React from 'react';
import styled from 'styled-components';

const MixContainer = styled.div`
  position: relative;
  height: ${(props) => props.height || '50px'};
  margin: auto;
  overflow: hidden;
`;

const MixArt = styled.img`
  position: relative;
  width: 50px;
  margin: 0;
  user-drag: none;
  vertical-align: middle;
`;

const MixWidget = (props) => (
  <MixContainer {...props}>
    <MixArt active={props.active} src={props.image} />
  </MixContainer>
);

export default styled(MixWidget)``;
