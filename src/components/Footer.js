import React from 'react';
import styled from 'styled-components';
import EmailForm from '../components/EmailForm';

const FooterWrapper = styled.footer`
  position: relative;
  display: flex;
  width: 100%;
  height: 3.5em;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #000000;
  font-size: 3em;
  font-weight: bold;
  line-height: 1.2;
`;

export default () => (
  <FooterWrapper>
    <EmailForm />
  </FooterWrapper>
);
