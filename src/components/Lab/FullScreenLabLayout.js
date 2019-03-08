import React from 'react';
import styled from 'styled-components';
import Helmet from 'react-helmet';

import LabHeader from './LabHeader';
import SiteContainer from '../containers/SiteContainer';
import '../globalStyles';

const Viewport = styled.div`
  position: absolute;
  bottom: 0;
  top: 4em;
`;

const FullScreenLayout = ({children}) => (
  <>
    <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} />
    <SiteContainer>
      <LabHeader />
      <Viewport>{children}</Viewport>
    </SiteContainer>
  </>
);

export default FullScreenLayout;
