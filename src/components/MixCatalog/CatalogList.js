import React from 'react';
import styled from 'styled-components';

const MixList = styled.div`
  /* margin: 10px 1vw;
  display: flex;
  flex-flow: row wrap;
  justify-content: space-evenly; */
  margin: 10px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 10px;
`;

const MixItem = styled.img`
  margin: 0;
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
