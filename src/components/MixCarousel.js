import React from 'react';
import styled from 'styled-components';
import {Link} from 'gatsby';
import MixWidget from './MixWidget';
import {liveMixes} from '../content/mixes';
import AudioMetaContext from './contexts/audio/AudioMetaContext';
import AudioSourceContext from './contexts/audio/AudioSourceContext';

const getMixWidgetLoader = ({className}, meta, mx) => {
  return (
    <AudioSourceContext.Consumer key={mx.id}>
      {({set}) => {
        const setter = () => {
          set(mx.id, true);
        };
        return <MixWidget image={mx.art} active={meta && meta.id === mx.id} onClick={setter} className={className} />;
      }}
    </AudioSourceContext.Consumer>
  );
};

const getMixWidgetLink = ({className}, meta, mx) => {
  return (
    <Link key={mx.id} to={`/mixes/?mx=${mx.id}`}>
      <MixWidget image={mx.art} active={meta && meta.id === mx.id} className={className} />
    </Link>
  );
};

const RelativeWrapper = styled.div`
  position: relative;
  box-sizing: content-box;
  padding-top: 12px;
  height: 100%;
`;

const CarouselWrapper = styled.div`
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow-x: scroll;
  overflow-y: hidden;
  white-space: nowrap;
  padding: 0px 20px;

  ${MixWidget} {
    display: inline-block;
    transform: opacity grayscale;
    transition-duration: 0.5s;
    transition-timing-function: ease-in-out;
  }

  &:before {
    content: '';
    z-index: 1;
    position: absolute;
    left: 0;
    pointer-events: none;
    height: 100%;
    width: 20px;
    background-image: linear-gradient(to left, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1) 90%);
  }

  &:after {
    content: '';
    z-index: 1;
    position: absolute;
    right: 0;
    pointer-events: none;
    height: 100%;
    width: 20px;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1) 90%);
  }

  * + * {
    margin-left: 2em;
  }

  &:hover ${MixWidget} {
    opacity: 0.3;
    filter: grayscale(60%);

    &:hover {
      opacity: 1;
      filter: grayscale(0%);
    }
  }
`;

export default (props) => {
  const {navigate} = props;
  const mixGetter = navigate ? getMixWidgetLink : getMixWidgetLoader;
  return (
    <AudioMetaContext.Consumer>
      {({meta}) => (
        <RelativeWrapper>
          <CarouselWrapper>{liveMixes.map((mx) => mixGetter(props, meta, mx))}</CarouselWrapper>
        </RelativeWrapper>
      )}
    </AudioMetaContext.Consumer>
  );
};
