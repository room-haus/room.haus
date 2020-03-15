import React, {useRef} from 'react';
import styled, {css} from 'styled-components';
import {Link as RouterLink} from 'react-router-dom';
import useDimensions from 'src/components/hooks/useDimensions';

const MixItem = styled.img`
  margin: 0;
  user-drag: none;
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

  /* @media (max-width: 700px) {
    grid-template-columns: repeat(20, 1fr);
  } */

  ${MixItem} {
    transform: opacity grayscale;
    transition-duration: 0.3s;
    transition-timing-function: ease-in-out;
  }

  ${({fadeOnHover}) => (fadeOnHover ? fadeStyles : null)}
`;

const getContentLink = ({className}, item) => {
  const url = item.id.startsWith('MX') ? `/mixes/?mx=${item.catalogueNumber}` : `/releases/${item.slug}`;
  return (
    <Link key={item.id} to={url}>
      <MixItem src={item.art} className={className} />
    </Link>
  );
};

export default ({content, columns, density = 5, fadeOnHover, ...props}) => {
  const ref = useRef();
  const {width} = useDimensions(ref);
  const autoColumns = width < 700 ? 7 : 20;
  return (
    <MixList innerRef={ref} columns={columns || autoColumns} density={density} fadeOnHover={fadeOnHover}>
      {content.map((item) => getContentLink(props, item))}
    </MixList>
  );
};
