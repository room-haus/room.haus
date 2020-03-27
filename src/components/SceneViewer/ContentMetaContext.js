import React, {useEffect, useState, useContext, useCallback} from 'react';
import {getContent} from 'src/content';

export const Context = React.createContext({meta: {}});

export default (props) => {
  const [contentId, _setContentId] = useState();
  const [trackIndex, setTrackIndex] = useState(0);
  const setContentId = useCallback((id) => {
    _setContentId(id);
    setTrackIndex(0);
  }, []);
  const [state, setState] = useState({
    setContentId,
    setTrackIndex,
    trackIndex,
    meta: {},
    streamURL: undefined,
  });
  useEffect(() => {
    if (contentId) {
      const meta = getContent(contentId);
      setTrackIndex(trackIndex);
      setState((prev) => ({...prev, meta, trackIndex}));
    }
  }, [contentId, trackIndex]);
  return <Context.Provider value={state} {...props} />;
};

export const useContentMetaContext = () => {
  const content = {...(useContext(Context) || {})};
  if (content.meta.tracks) {
    content.streamURL = content.meta.tracks[content.trackIndex].streamURL;
  } else {
    content.streamURL = content.meta.audioSourceURL;
  }
  return content;
};
