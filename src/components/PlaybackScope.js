import React, {useEffect, useRef} from 'react';

export default function PlaybackScope({audio, active}) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext('2d');
    if (!context || !active || !audio?.analyser) return;
    let frame;
    let last = 0;
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 32 || document.hidden) return;
      last = now;
      const values = audio?.getTimeDomainData?.();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (!values?.length) return;
      context.beginPath();
      for (let x = 0; x < width; x++) {
        const y = height * (values[Math.floor((x * values.length) / width)] / 255);
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.lineWidth = 1.5;
      context.strokeStyle = '#daffaf';
      context.stroke();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, audio]);
  return <canvas ref={ref} className="playback-scope" aria-hidden="true" />;
}
