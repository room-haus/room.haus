import React from 'react';
import AudioSourceContext from '../audio2/AudioSourceContext';
import MixMetaContext from '../components/SceneViewer/MixMetaContext';
import FullScreenLayout from '../components/FullScreenLayout';
import SceneViewer from '../components/SceneViewer';
import {getMix} from '../content/mixes';
import MixCatalog from '../components/MixCatalog';
import useURLParams from '../hooks/useURLParams';

const MixPage = ({location}) => {
  let mx = useURLParams(location.search).get('mx');
  mx = getMix(mx);
  return mx ? (
    <AudioSourceContext>
      <MixMetaContext>
        <FullScreenLayout>
          <SceneViewer sceneId={mx.id} mixId={mx.id} />
        </FullScreenLayout>
      </MixMetaContext>
    </AudioSourceContext>
  ) : (
    <MixCatalog />
  );
};

export default MixPage;
