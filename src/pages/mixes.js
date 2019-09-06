import React from 'react';
import SceneViewer from 'src/components/SceneViewer';
import {getMix} from 'src/mixes/';
import useURLParams from 'src/components/hooks/useURLParams';
import SiteLayout from 'src/components/layout/SiteLayout';

const MixPage = () => {
  let mx = useURLParams(window.location.search).get('mx');
  mx = getMix(mx);
  const id = mx ? mx.id : null;
  return (
    <SiteLayout mixSceneMode={Boolean(mx)}>
      <SceneViewer showCatalogOverlay={!mx} sceneId={id} mixId={id} />
    </SiteLayout>
  );
};

export default MixPage;
