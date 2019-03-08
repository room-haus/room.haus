import React from 'react';
import styled from 'styled-components';
import {Link} from 'gatsby';
import Carousel from 'nuka-carousel';
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

const CarouselWrapper = styled.div`
  padding: 0.5em 5px;
  border-bottom: 1px solid gray;
  border-top: 1px solid gray;

  ${MixWidget} {
    transform: opacity grayscale;
    transition-duration: 0.5s;
    transition-timing-function: ease-in-out;
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
        <CarouselWrapper>
          <Carousel withoutControls speed={2000} {...props} wrapAround={false}>
            {liveMixes.map((mx) => mixGetter(props, meta, mx))}
          </Carousel>
        </CarouselWrapper>
      )}
    </AudioMetaContext.Consumer>
  );
};
