import React from 'react';
import styled from 'styled-components';
import AudioSourceContext from '../contexts/audio/AudioSourceContext';
import ErrorBoundary from '../ErrorBoundary';

const SiteContainer = styled.div`
  margin: 0;
  display: grid;
  grid-template-areas:
    'header'
    'viewport';
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  overflow: hidden;
  height: 100vh;
`;

export default (props) => (
  <ErrorBoundary>
    <AudioSourceContext>
      <SiteContainer {...props} />
    </AudioSourceContext>
  </ErrorBoundary>
);
