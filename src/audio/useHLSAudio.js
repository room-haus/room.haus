import {useEffect, useContext} from 'react';
import {Context} from './AudioSourceContext';

export default (manifestURL) => {
  const {audio} = useContext(Context);

  useEffect(() => {
    manifestURL && audio.setManifestUrl(manifestURL);
  }, [manifestURL]);

  return audio;
};
