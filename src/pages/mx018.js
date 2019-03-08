import React from 'react';
import AudioSourceContext from '../components/contexts/audio/AudioSourceContext';
import FullScreenLayout from '../components/FullScreenLayout';
import SceneViewer from '../components/SceneViewer';

const MixPage = () => (
  <FullScreenLayout>
    <AudioSourceContext.Consumer>
      {({source, set}) => (
        <SceneViewer
          scene="MX018"
          onInit={() => set(545844510)}
          source={source}
        />
      )}
    </AudioSourceContext.Consumer>
  </FullScreenLayout>
);

export default MixPage;
