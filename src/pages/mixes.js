import React from 'react';
import AudioSourceContext from '../components/contexts/audio/AudioSourceContext';
import FullScreenLayout from '../components/FullScreenLayout';
import SceneViewer from '../components/SceneViewer';
import {getMix} from '../content/mixes';
import MixCatalog from '../components/MixCatalog';

const getParams = (search) => {
  const params = {};
  search
    .split('?')
    .pop()
    .split('&')
    .forEach((kvpair) => {
      const [key, value] = kvpair.split('=');
      params[key] = value;
    });
  return params;
};

const MixPage = ({location}) => {
  let {mx} = getParams(location.search);
  mx = getMix(mx);
  return mx ? (
    <FullScreenLayout>
      <AudioSourceContext.Consumer>
        {({source, set}) => <SceneViewer scene={mx.id} source={source} setter={set} />}
      </AudioSourceContext.Consumer>
    </FullScreenLayout>
  ) : (
    <MixCatalog />
  );
};

export default MixPage;
