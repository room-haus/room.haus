import styled from 'styled-components';
import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import AudioSourceContext from 'audio/AudioSourceContext';
import MixMetaContext from './src/components/SceneViewer/MixMetaContext';
import Header from '../header';

const Screen = styled.div`
  position: relative;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const SiteContainer = styled.div`
  margin: 0;
  padding: 0;
  display: grid;
  position: ${({fixToViewport}) => (fixToViewport ? 'fixed' : 'relative')};
  grid-template-areas:
    'header'
    'viewport';
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
  height: 100%;
  width: 100%;
`;

const Viewport = styled.div`
  grid-area: viewport;
  position: relative;
`;

const SiteHeader = styled(Header)`
  grid-area: header;
`;

const SiteLayout = ({children, mixSceneMode}) => {
  return (
    <>
      <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} />
      <AudioSourceContext>
        <MixMetaContext>
          <Screen>
            <SiteContainer fixToViewport={mixSceneMode}>
              <SiteHeader disableFlyout={!mixSceneMode} />
              <Viewport>{children}</Viewport>
            </SiteContainer>
          </Screen>
        </MixMetaContext>
      </AudioSourceContext>
    </>
  );
};

SiteLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SiteLayout;
