/**
 * Implement Gatsby's SSR (Server Side Rendering) APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/ssr-apis/
 */

// You can delete this file if you're not using it
// import React from 'react';
// import Helmet from 'react-helmet';
// import AudioSourceContext from './src/audio2/AudioSourceContext';
// import MixMetaContext from './src/components/SceneViewer/MixMetaContext';

require('./src/components/globalStyles.js');

// /* eslint-disable */
// // export const wrapPageElement = ({element, props}) => {
// //   return <SiteLayout {...props}>{element}</SiteLayout>;
// // };

// export const wrapRootElement = ({element}) => {
//   return (
//     <AudioSourceContext>
//       <Helmet title="ROOM" meta={[{name: 'description', content: 'Virtual Imprints'}]} />
//       <MixMetaContext>{element}</MixMetaContext>
//     </AudioSourceContext>
//   );
// };
