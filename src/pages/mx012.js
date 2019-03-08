import React from 'react';
import AudioSourceContext from '../components/contexts/audio/AudioSourceContext';
import FullScreenLayout from '../components/FullScreenLayout';
import SceneViewer from '../components/SceneViewer';

const MixPage = () => (
  <FullScreenLayout>
    <AudioSourceContext.Consumer>
      {({source, set}) => (
        <SceneViewer
          scene="MX012"
          onInit={() => set(526151109)}
          source={source}
        />
      )}
    </AudioSourceContext.Consumer>
  </FullScreenLayout>
);

export default MixPage;
