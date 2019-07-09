import React from 'react';
import styled from 'styled-components';
import CatalogHeader from 'src/components/MixCatalog/CatalogHeader';
import CatalogList from 'src/components/MixCatalog/CatalogList';
import {mixes} from 'src/content/mixes';
import HeaderPlayer from './HeaderPlayer';
import HeaderFlyout from './layout/HeaderFlyout';

const CarouselContainer = styled.div`
  border-bottom: 1px solid gray;
  border-top: 1px solid gray;
  background: #f5f6f6;
  top: 4.5em;
  left: 0;
  width: 100vw;
`;

const Main = (props) => <CatalogHeader {...props} />;
const Flyout = () => (
  <>
    <HeaderPlayer />
    <CarouselContainer>
      <CatalogList mixes={mixes} columns={20} density={2} />
    </CarouselContainer>
  </>
);

const Header = (props) => {
  return <HeaderFlyout {...props} MainComponent={Main} FlyoutComponent={Flyout} />;
};

export default Header;
