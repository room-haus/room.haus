import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const NotFoundPage = () => (
  <Container>
    <h1>Well this isnt right...</h1>
    <img src="https://i.imgur.com/qKGAmin.gif" alt="You're lost" />
  </Container>
);

export default NotFoundPage;
