import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';

import Header from './header';
import SiteContainer from './containers/SiteContainer';
import './globalStyles';

const Viewport = styled.div`
  grid-area: viewport;
`;

const SiteHeader = styled(Header)`
  grid-area: header;
`;

const FullScreenLayout = ({children}) => (
  <>
    <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} />
    <SiteContainer>
      <SiteHeader tactile />
      <Viewport>{children}</Viewport>
    </SiteContainer>
  </>
);

FullScreenLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default FullScreenLayout;
