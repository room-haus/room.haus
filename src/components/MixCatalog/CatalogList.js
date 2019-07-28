import React from 'react';
import styled, {css} from 'styled-components';
import {mixes as mixList} from 'src/mixes';
import {Link as RouterLink} from 'react-router-dom';

const MixItem = styled.img`
  margin: 0;
`;

const Link = styled(RouterLink)`
  text-decoration: none;
`;

const fadeStyles = css`
  &:hover ${MixItem} {
    opacity: 0.3;
    filter: grayscale(60%);

    &:hover {
      opacity: 1;
      filter: grayscale(0%);
    }
  }
`;

const MixList = styled.div`
  margin: 10px;
  display: grid;
  grid-template-columns: repeat(${({columns}) => columns}, 1fr);
  grid-gap: ${({density}) => `${density}vmin`};
  /* grid-gap: 5vmin; */

  ${MixItem} {
    transform: opacity grayscale;
    transition-duration: 0.3s;
    transition-timing-function: ease-in-out;
  }

  ${({fadeOnHover}) => (fadeOnHover ? fadeStyles : null)}
`;

const getMixLink = ({className}, mix) => (
  <Link key={mix.id} to={`/mixes/?mx=${mix.catalogueNumber}`}>
    <MixItem src={mix.art} className={className} />
  </Link>
);

export default ({mixes = mixList, columns = 5, density = 5, ...props}) => {
  return (
    <MixList columns={columns} density={density}>
      {mixes.map((mix) => getMixLink(props, mix))}
    </MixList>
  );
};
