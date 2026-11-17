import React, {useEffect, useRef, useState} from 'react';

const fill = {position: 'absolute', inset: 0, height: '100%', width: '100%'};

class BackgroundBoundary extends React.Component {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? null : this.props.children; }
}

function Scene({record, audio, onError}) {
  const canvas = useRef(null);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  const [view, setView] = useState({ready: false});
  useEffect(() => {
    let cancelled = false;
    let manager;
    const surface = canvas.current;
    function close() {
      manager?.cleanUp();
      audio.clearSceneAnalysis();
    }
    function fail(error) {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(deadline);
      close();
      setView({ready: false, failed: true});
      errorHandler.current?.(error);
    }
    const deadline = setTimeout(() => fail(new Error('Scene loading timed out')), 30000);
    surface.addEventListener('webglcontextlost', fail);
    import(/* webpackChunkName: "scene-engine" */ '../babylon/BabylonSceneManager').then(async ({default: Manager}) => {
      if (cancelled) return;
      manager = new Manager(surface);
      await manager.run(record, audio, (Background) => {
        if (cancelled) return;
        clearTimeout(deadline);
        setView({ready: true, Background});
      }, fail);
    }).catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(deadline);
      surface.removeEventListener('webglcontextlost', fail);
      close();
    };
  }, [record, audio]);

  const {Background} = view;
  return (
    <div className="listening-scene" style={{...fill, overflow: 'hidden'}} data-scene-state={view.ready ? 'ready' : view.failed ? 'fallback' : 'loading'}>
      {Background && <div aria-hidden="true" style={fill}><BackgroundBoundary><Background source={audio} /></BackgroundBoundary></div>}
      <canvas ref={canvas} aria-label={record.id + ' animated CD scene'} style={{...fill, display: 'block', opacity: view.ready ? 1 : 0}} />
      {!view.ready && <img alt={record.id + ' cover artwork'} src={record.art} style={{...fill, objectFit: 'contain'}} />}
    </div>
  );
}

export default function ListeningScene(props) {
  return <Scene key={props.record.id + ':' + (props.audio.url || '')} {...props} />;
}
