import React from 'react';
import styled from 'styled-components';
import LoadingSpheres from './LoadingSpheres';

const SplashScreen = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #010302;
  z-index: 50;
  margin: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: ${({hide}) => (hide ? 0 : 1)};
  pointer-events: none;
  transition: opacity ${({fadeTime}) => fadeTime || 1}s ease-in-out;
`;

const SplashText = styled.span`
  font-family: NeueHaasGrotDisp;
  color: #c3c1c1;
  font-size: 2em;
  line-height: 1em;
  margin: auto;
  display: flex;
  justify-content: center;
`;

export default (props) => (
  <SplashScreen {...props}>
    <div>
      <SplashText>Room</SplashText>
      <LoadingSpheres />
    </div>
  </SplashScreen>
);
