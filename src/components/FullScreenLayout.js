import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';

import Header from './header';
import SiteContainer from './layout/SiteLayout';
import './globalStyles';

const Viewport = styled.div`
  grid-area: viewport;
`;

const SiteHeader = styled(Header)`
  grid-area: header;
`;

const FullScreenLayout = ({children}) => (
  <SiteContainer>
    <SiteHeader tactile />
    <Viewport>{children}</Viewport>
  </SiteContainer>
);

FullScreenLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default FullScreenLayout;
