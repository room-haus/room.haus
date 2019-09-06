import React from 'react';
import styled from 'styled-components';
import CatalogList from 'src/components/MixCatalog/CatalogList';
import {mixes} from 'src/mixes';
import HeaderPlayer from 'src/components/HeaderPlayer';
import {useAudioContext} from 'src/audio/AudioSourceContext';
import HeaderFlyout from '../layout/HeaderFlyout';
import CatalogHeader from './CatalogHeader';

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
      <CatalogList mixes={mixes} density={2} fadeOnHover />
    </CarouselContainer>
  </>
);

export default ({disableFlyout, ...props}) => {
  const {ready} = useAudioContext();
  return (
    <HeaderFlyout
      {...props}
      MainComponent={Main}
      FlyoutComponent={Flyout}
      forceActive={!ready}
      disableFlyout={disableFlyout}
    />
  );
};
