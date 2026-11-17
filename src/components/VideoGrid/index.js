import React, {useRef, useEffect} from 'react';
import {loadVideo, tileVideoCanvas} from './helpers';

export default function VideoGrid({source, videos, columns, rows}) {
  const canvasRef = useRef(null);
  const urls = videos.join('\n');
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const media = urls.split('\n').map(() => document.createElement('video'));
    const detach = urls.split('\n').map((url, i) => loadVideo(media[i], url));
    let matrix;
    function resize() {
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight));
      const wide = canvas.width >= canvas.height;
      matrix = Array.from({length: rows || (wide ? 2 : 4)}, () => Array(columns || (wide ? 4 : 2)).fill(0));
    }
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    if (media.length > 1) source.startWorklet();
    const unsubscribe = source.setOnsetCallback(() => {
      const row = matrix[Math.floor(Math.random() * matrix.length)];
      row[Math.floor(Math.random() * row.length)] = Math.floor(Math.random() * media.length);
    });
    let frame;
    function animate() {
      tileVideoCanvas(context, media, canvas, matrix);
      frame = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      observer?.disconnect();
      detach.forEach((stop) => stop());
    };
  }, [source, urls, columns, rows]);
  return <canvas ref={canvasRef} style={{display: 'block', width: '100%', height: '100%'}} />;
}
