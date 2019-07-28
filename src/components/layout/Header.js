import React from 'react';
import styled from 'styled-components';
import CatalogHeader from 'src/components/MixCatalog/CatalogHeader';
import CatalogList from 'src/components/MixCatalog/CatalogList';
import {mixes} from 'src/mixes';
import HeaderPlayer from 'src/components/HeaderPlayer';
import HeaderFlyout from './HeaderFlyout';

const getJustifySelf = ({position = 'middle'}) => {
  const mapping = {
    left: 'start',
    middle: 'center',
    right: 'end',
  };
  return mapping[position];
};

export const Header = styled.div`
  background: #f5f6f6;
  border-bottom: 1px solid gray;

  display: grid;
  grid-template-areas: 'left middle right';
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 5vh;
  align-items: center;
  padding: 0 10px;
`;

export const HeaderItem = styled.div`
  grid-area: ${({position}) => position || 'middle'};
  justify-self: ${getJustifySelf};
`;

const CarouselContainer = styled.div`
  border-bottom: 1px solid gray;
  border-top: 1px solid gray;
  background: #f5f6f6;
  top: 4.5em;
  left: 0;
  width: 100%;
`;

const Main = (props) => <CatalogHeader {...props} />;
const Flyout = () => (
  <>
    <HeaderPlayer />
    <CarouselContainer>
      <CatalogList mixes={mixes} columns={20} density={2} fadeOnHover />
    </CarouselContainer>
  </>
);

export default ({disableFlyout, ...props}) => (
  <HeaderFlyout {...props} MainComponent={Main} FlyoutComponent={Flyout} disableFlyout={disableFlyout} />
);
