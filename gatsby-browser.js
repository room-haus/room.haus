/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */

// You can delete this file if you're not using it
import React from 'react';
import Helmet from 'react-helmet';
import AudioSourceContext from './src/audio2/AudioSourceContext';
import MixMetaContext from './src/components/SceneViewer/MixMetaContext';
import SiteLayout from './src/components/layout/SiteLayout';
import {getMix} from './src/content/mixes';

require('./src/components/globalStyles.js');

export const wrapPageElement = ({element, props}) => {
  const {location} = props;
  const params = new URLSearchParams(location.search);
  let mx = params.get('mx');
  mx = getMix(mx);
  console.log('IM WRAPPING A FUCKING ELEMENT', element);
  return (
    <SiteLayout {...props} mixSceneMode={Boolean(mx)}>
      {element}
    </SiteLayout>
  );
};

export const wrapRootElement = ({element}) => {
  console.log('ROOT FUCKING ELEMENT');
  return (
    <AudioSourceContext>
      <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} />
      <MixMetaContext>{element}</MixMetaContext>
    </AudioSourceContext>
  );
};
