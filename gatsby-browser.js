/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */

// You can delete this file if you're not using it
import React from 'react';
import AudioSourceContext from './src/audio2/AudioSourceContext';
import MixMetaContext from './src/components/SceneViewer/MixMetaContext';
import FullScreenLayout from './src/components/FullScreenLayout';

require('./src/components/layout.css');

/* eslint-disable */
export const wrapPageElement = ({element}) => {
  return (
    <AudioSourceContext>
      <MixMetaContext>
        <FullScreenLayout>{element}</FullScreenLayout>
      </MixMetaContext>
    </AudioSourceContext>
  );
};
