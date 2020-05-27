import styled from 'styled-components';
import React from 'react';
import PropTypes from 'prop-types';
// import Helmet from 'react-helmet';
import MixHeader from 'src/components/MixCatalog/MixHeader';

const Screen = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
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
  overflow-y: ${({fixToViewport}) => (fixToViewport ? 'hide' : 'auto')};
`;

const SiteHeader = styled(MixHeader)`
  grid-area: header;
`;

const SiteLayout = ({children, mixSceneMode}) => {
  return (
    <>
      {/* <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} /> */}
      <Screen>
        <SiteContainer fixToViewport={mixSceneMode}>
          <SiteHeader disableFlyout={!mixSceneMode} />
          <Viewport fixToViewport={mixSceneMode}>{children}</Viewport>
        </SiteContainer>
      </Screen>
    </>
  );
};

SiteLayout.defaultProps = {
  mixSceneMode: false,
};

SiteLayout.propTypes = {
  children: PropTypes.node.isRequired,
  mixSceneMode: PropTypes.bool,
};

export default SiteLayout;
