import React from 'react';
// import styled from 'styled-components';
import AudioMetaContext from '../contexts/audio/AudioMetaContext';

const getCurrentTime = (source) => {
  const time = source ? source.currentTime() : null;
  if (!time) {
    return '00:00';
  }
  const minutes = String(Math.floor(time / 60)).padStart(2, '0');
  const seconds = String(Math.round(time % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const MetaInfo = ({source, className}) => {
  return (
    <AudioMetaContext.Consumer>
      {({meta}) => (
        <div className={className}>
          {meta.artist} - {meta.name} {getCurrentTime(source)}
        </div>
      )}
    </AudioMetaContext.Consumer>
  );
};

export default MetaInfo;
