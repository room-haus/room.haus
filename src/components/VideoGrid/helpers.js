import {attachStream} from '../../audio/attachStream';

export function loadVideo(video, url) {
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  let detach;
  const failed = () => detach?.();
  detach = attachStream(video, url, () => video.play()?.catch(() => {}), failed);
  return detach;
}

export function tileVideoCanvas(context, videos, canvas, matrix) {
  const w = canvas.width / matrix[0].length;
  const h = canvas.height / matrix.length;
  matrix.forEach((row, y) => row.forEach((index, x) => {
    const video = videos[index];
    if (video.readyState >= 2 && video.videoWidth) context.drawImage(video, x * w, y * h, w, h);
  }));
}
