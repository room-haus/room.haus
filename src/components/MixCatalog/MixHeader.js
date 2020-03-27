import React, {useState} from 'react';
import styled from 'styled-components';
import CatalogList from 'src/components/MixCatalog/CatalogList';
import {getContentList} from 'src/content';
import HeaderPlayer from 'src/components/HeaderPlayer';
import {useContentMetaContext} from 'src/components/SceneViewer/ContentMetaContext';
import HeaderFlyout from '../layout/HeaderFlyout';
import CatalogHeader from './CatalogHeader';

const CarouselContainer = styled.div`
  border-bottom: 1px solid gray;
  top: 4.5em;
  left: 0;
  width: 100%;
`;

const Divider = styled.hr`
  display: block;
  margin: 0 1%;
`;

const Main = (props) => <CatalogHeader {...props} />;
const Flyout = () => (
  <>
    <HeaderPlayer />
    <CarouselContainer>
      <Divider />
      <CatalogList content={getContentList('mix')} density={2} fadeOnHover />
    </CarouselContainer>
  </>
);

const TrackList = styled.ul`
  margin: 0 3%;
  list-style: none;
  display: flex;
  justify-content: space-evenly;
  align-items: center;

  li {
    font-size: 3vw;
    display: inline-block;
    padding: 0;
    margin: 0;
    line-height: 1em;
  }

  & > li.active {
    border: 1px solid;
  }
`;
const TrackSelect = () => {
  const {meta, setTrackIndex, trackIndex} = useContentMetaContext();
  const tracks = meta.tracks || [];
  return (
    <>
      <HeaderPlayer />
      <CarouselContainer>
        <Divider />
        <TrackList>
          {tracks.map((t, index) => (
            <li key={t.name} className={trackIndex === index ? 'active' : ''} onClick={() => setTrackIndex(index)}>
              {t.name}
            </li>
          ))}
        </TrackList>
      </CarouselContainer>
    </>
  );
};

export default ({disableFlyout, contentViewType, ...props}) => {
  const flyout = contentViewType === 'release' ? TrackSelect : Flyout;
  return <HeaderFlyout {...props} MainComponent={Main} FlyoutComponent={flyout} disableFlyout={disableFlyout} />;
};
