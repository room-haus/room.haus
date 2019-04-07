import HLS from 'hls.js';

export const randomInt = (min, max) => {
  if (max === undefined) {
    return Math.floor(Math.random() * min);
  }
  return Math.floor(Math.random() * (max - min) + min);
};

export const tileVideoCanvas = (context, videos, canvas, matrix) => {
  if (!matrix || matrix[0] === undefined) {
    return;
  }
  const {width, height} = canvas;
  const columns = matrix[0].length;
  const rows = matrix.length;
  const tileWidth = width / columns;
  const tileHeight = height / rows;
  for (let x = 0; x < columns; x++) {
    for (let y = 0; y < rows; y++) {
      const index = matrix[y][x];
      const video = videos[index].ref.current;
      video && context.drawImage(video, x * tileWidth, y * tileHeight, tileWidth, tileHeight);
    }
  }
};

export const setVideoMatrix = (videos, columns, rows) => {
  const matrix = [];
  for (let y = 0; y < rows; y++) {
    matrix.push([]);
    for (let x = 0; x < columns; x++) {
      const index = 0;
      matrix[y].push(index);
    }
  }
  return matrix;
};

export const loadVideo = (video) => {
  if (HLS.isSupported()) {
    video.hls = new HLS();
    video.hls.loadSource(video.manifestUrl);
    video.hls.attachMedia(video.ref.current);
  } else {
    video.ref.current.src = video.manifestUrl;
  }
};
