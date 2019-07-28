import React from 'react';
import SceneViewer from '../components/SceneViewer';
import {getMix} from '../content/mixes';
import useURLParams from '../hooks/useURLParams';

const MixPage = ({location}) => {
  let mx = useURLParams(location.search).get('mx');
  mx = getMix(mx);
  const id = mx ? mx.id : null;
  return <SceneViewer showCatalogOverlay={!mx} sceneId={id} mixId={id} />;
};

export default MixPage;
