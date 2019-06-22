import React from 'react';
import styled from 'styled-components';

const MixItem = styled.img`
  margin: 0;
`;

const MixList = styled.div`
  margin: 10px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 5vmin;

  ${MixItem} {
    transform: opacity grayscale;
    transition-duration: 0.5s;
    transition-timing-function: ease-in-out;
  }

  &:hover ${MixItem} {
    opacity: 0.3;
    filter: grayscale(60%);

    &:hover {
      opacity: 1;
      filter: grayscale(0%);
    }
  }
`;

export default ({mixes = []}) => {
  return (
    <MixList>
      {mixes.map((mix) => (
        <MixItem key={mix.id} src={mix.art} />
      ))}
    </MixList>
  );
};
