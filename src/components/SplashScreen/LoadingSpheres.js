import React from 'react';
import styled, {keyframes} from 'styled-components';

const dot = keyframes`
  50% {
    transform: translateX(81px);
  }
`;

const Sphere = styled.span`
  position: absolute;
  width: 16px;
  height: 16px;
  top: 12px;
  left: 15px;
  filter: blur(4px);
  background: #ccc;
  border-radius: 50%;
  transform: translateX(0);
  animation: ${dot} 2.8s infinite;
`;

const dots = keyframes`
  50% {
    transform: translateX(-31px);
  }
`;

const Spheres = styled.div`
  transform: translateX(0);
  margin-top: 12px;
  margin-left: 31px;
  animation: ${dots} 2.8s infinite;

  span {
    background: #ccc;
    display: block;
    float: left;
    width: 16px;
    height: 16px;
    margin-left: 12px;
    filter: blur(4px);
    border-radius: 50%;
  }
`;

const Container = styled.div`
  position: relative;
  width: 100%;
  background: #010302;
  filter: contrast(20);
  overflow: hidden;
  margin-right: 10px;
`;

export default (props) => (
  <Container {...props}>
    <Sphere className={props.className} />
    <Spheres className={props.className}>
      <span className={props.className} />
      <span className={props.className} />
      <span className={props.className} />
    </Spheres>
  </Container>
);
