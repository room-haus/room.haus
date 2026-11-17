// Native HLS must attach synchronously so Safari can honor the original play gesture.
export function attachStream(media, url, onReady, onError) {
  let closed = false;
  let hls;
  const fail = (reason) => { if (!closed) onError(reason); };
  if (!/\.m3u8(?:$|[?#])/i.test(url) || media.canPlayType('application/vnd.apple.mpegurl')) {
    media.src = url;
    onReady();
  } else {
    import(/* webpackChunkName: "hls" */ 'hls.js').then(({default: Hls}) => {
      if (closed) return;
      if (!Hls.isSupported()) {
        fail('This browser cannot play this stream.');
        return;
      }
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) fail('The stream could not be loaded.');
      });
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (closed) return;
        hls.loadSource(url);
        onReady();
      });
      hls.attachMedia(media);
    }).catch(() => fail('The stream player could not be loaded.'));
  }
  return () => {
    closed = true;
    media.pause();
    if (hls) hls.destroy();
    media.removeAttribute('src');
    media.load();
  };
}
