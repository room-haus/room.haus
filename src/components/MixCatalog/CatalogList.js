import React from 'react';
import styled from 'styled-components';
import {Link} from 'gatsby';

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
    opacity: 0.7;
    filter: grayscale(60%);

    &:hover {
      opacity: 1;
      filter: grayscale(0%);
    }
  }
`;

const getMixLink = ({className}, mix) => (
  <Link key={mix.id} to={`/mixes/?mx=${mix.catalogueNumber}`}>
    <MixItem src={mix.art} className={className} />
  </Link>
);

export default (props) => {
  const {mixes = []} = props;
  return <MixList>{mixes.map((mix) => getMixLink(props, mix))}</MixList>;
};
