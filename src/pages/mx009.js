import React from 'react';
import AudioSourceContext from '../components/contexts/audio/AudioSourceContext';
import FullScreenLayout from '../components/FullScreenLayout';
import SceneViewer from '../components/SceneViewer';

const MixPage = () => (
  <FullScreenLayout>
    <AudioSourceContext.Consumer>
      {({source, set}) => (
        <SceneViewer
          scene="MX009"
          source={source}
          onInit={() => set(515678430)}
        />
      )}
    </AudioSourceContext.Consumer>
  </FullScreenLayout>
);

export default MixPage;
