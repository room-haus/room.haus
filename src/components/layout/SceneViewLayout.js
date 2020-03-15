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

const LayoutGrid = styled.div`
  margin: 0;
  padding: 0;
  display: grid;
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

const SceneViewLayout = ({children, mixSceneMode, contentViewType}) => {
  return (
    <>
      {/* <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} /> */}
      <Screen>
        <LayoutGrid>
          <SiteHeader disableFlyout={!mixSceneMode} contentViewType={contentViewType} />
          <Viewport fixToViewport={mixSceneMode}>{children}</Viewport>
        </LayoutGrid>
      </Screen>
    </>
  );
};

SceneViewLayout.defaultProps = {
  mixSceneMode: false,
};

SceneViewLayout.propTypes = {
  children: PropTypes.node.isRequired,
  mixSceneMode: PropTypes.bool,
};

export default SceneViewLayout;
