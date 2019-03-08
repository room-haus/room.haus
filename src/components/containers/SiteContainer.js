import React from 'react';
import styled from 'styled-components';
import AudioSourceContext from '../contexts/audio/AudioSourceContext';
import MousePositionContext from '../contexts/MousePositionContext';
import ErrorBoundary from '../ErrorBoundary';

const SiteContainer = styled.div`
  box-sizing: border-box;
  width: 100%;
  height: ${(props) => (props.fullScreen ? '100vh' : '100%')};
  margin: 0;
  padding-top: 7.5em;
`;

export default (props) => (
  <ErrorBoundary>
    <AudioSourceContext>
      <MousePositionContext>
        <SiteContainer {...props} />
      </MousePositionContext>
    </AudioSourceContext>
  </ErrorBoundary>
);
