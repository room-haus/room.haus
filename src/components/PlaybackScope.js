import React, {useEffect, useRef} from 'react';

export default function PlaybackScope({audio, active}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const controller = new AbortController();
    let read = () => audio.getTimeDomainData();
    if (!audio.analyser && /\.m3u8(?:$|[?#])/i.test(audio.url) && window.OfflineAudioContext) {
      import(/* webpackChunkName: "native-waveform" */ '../audio/nativeWaveform')
        .then(({nativeWaveform}) => nativeWaveform(audio.url, controller.signal))
        .then(sample => { if (sample) read = () => sample(audio.media?.currentTime ?? 0); })
        .catch(() => {});
    }

    let frame;
    let last = 0;
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || now - last < 32) return;
      last = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      const values = read();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!values?.length) return;
      context.beginPath();
      const xScale = width / (values.length - 1);
      // Give quiet recordings some headroom on a phone-sized display. Silence
      // stays flat, and the loudest excursions still fit inside the control.
      let peak = 0;
      for (const sample of values) peak = Math.max(peak, Math.abs(sample - 128));
      const yScale = (height / 2 - 5) / Math.max(32, peak);
      context.moveTo(0, height / 2 + (values[0] - 128) * yScale);
      for (let i = 1; i < values.length; i++) {
        context.lineTo(i * xScale, height / 2 + (values[i] - 128) * yScale);
      }
      context.lineWidth = 1;
      context.strokeStyle = '#f5f5f5';
      context.stroke();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [active, audio]);
  return <canvas key={audio.url} ref={ref} className="playback-scope" aria-hidden="true" />;
}
