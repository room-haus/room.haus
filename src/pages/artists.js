import React from 'react';
import styled from 'styled-components';
import '../components/globalStyles';
import Layout from '../components/layout';

const ArtistList = styled.ul`
  font-family: 'Favorit';
  list-style: none;
  margin: 6em 0;
  padding: 0;
`;

const Artist = styled.li`
  display: block;
  font-size: 3em;
  font-weight: bold;
  line-height: 1.3em;
  margin: 0;
  padding: 0;
`;

const artists = [
  {name: '35MM', img: ''},
  {name: 'EDDYBUAER', img: ''},
  {name: 'IWAN THICKETT', img: ''},
  {name: 'AV', img: ''},
  {name: 'ARTICIL', img: ''},
  {name: 'BLACKFOOT MILLIE', img: ''},
  {name: 'BIG CHAIN', img: ''},
];

const ArtistPage = () => (
  <Layout>
    <ArtistList>
      {artists.map((artist) => (
        <Artist key={artist.name}>{artist.name}</Artist>
      ))}
    </ArtistList>
  </Layout>
);

export default ArtistPage;
