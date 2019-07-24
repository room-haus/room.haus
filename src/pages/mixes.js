import React from 'react';
import SceneViewer from '../components/SceneViewer';
import {getMix} from '../content/mixes';
import MixCatalog from '../components/MixCatalog';
import useURLParams from '../hooks/useURLParams';

const MixPage = ({location}) => {
  let mx = useURLParams(location.search).get('mx');
  mx = getMix(mx);
  return mx ? <SceneViewer sceneId={mx.id} mixId={mx.id} /> : <MixCatalog />;
};

export default MixPage;
