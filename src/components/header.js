import React from 'react';
import styled from 'styled-components';
import MixCarousel from './MixCarousel';
import HeaderPlayer from './HeaderPlayer';
import RoomLogo from '../images/logo.png';
import SoundCloudIcon from '../images/soundcloud-icon.png';
import InstagramIcon from '../images/instagram-icon.png';
import MousePositionContext from './contexts/MousePositionContext';

const transformEasing = ({position}) => {
  const menuHeight = 81 + 54;
  const threshold = menuHeight + 80;
  if (position <= threshold) {
    return 0;
  }
  return '-81px';
};

const opacityEasing = ({position}) => {
  const menuHeight = 81 + 54;
  const threshold = menuHeight + 65;
  if (position <= threshold) {
    return 1;
  }
  return 0;
};

const BottomRow = styled.div`
  height: 4.5em;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  transform: translateY(${transformEasing});
  opacity: ${opacityEasing};
  transition: transform 0.3s ease-in-out, opacity 0.3s ease-in;
  z-index: 1;
  position: fixed;
  top: 3em;
  left: 0;
  background: #f5f6f6;
  width: 100%;
  padding: 0 0.5em;
`;

const TopRow = styled.div`
  width: 100%;
  height: 3em;
  position: fixed;
  top: 0;
  background: #f5f6f6;
  display: flex;
  z-index: 2;
  left: 0;
  width: 100%;
  align-items: center;
  padding: 0 0.5em;
`;

const RoomIcon = styled.img`
  height: 80%;
  margin: 0;
  position: absolute;
  display: block;
`;

const IconContainer = styled.div`
  position: absolute;
  right: 0;
  /* margin: 0.3em 0 0 0.3em; */
  height: 100%;
  width: 25%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 0.5em;
  padding-right: 0.5em;
  min-width: 150px;

  a + a {
    margin-left: 1em;
  }

  & a {
    display: inline-block;
    height: 100%;
    margin: 0;
    position: relative;

    img {
      margin: 0;
      height: 80%;
    }
  }
`;

const TactileContainer = styled.div`
  width: 55px;
  margin: auto;
`;

const Tactile = styled.div`
  opacity: 1;
  width: 100%;
  height: 4px;
  border: 1px solid #939296;

  & + & {
    margin-top: 3px;
  }
`;

const HeaderContainer = styled.header`
  height: ${(props) => (props.hidden ? '5.5em' : '7.3em')};
  width: 100%;
  z-index: 10;
  top: 0;
  background: transparent;
  font-family: 'NeueHaasGrotDisp';
  padding: 0.1em 0.4em;
`;

const PageDescription = styled.span`
  width: 20em;
  font-size: 1.2em;
  justify-self: start;

  @media (max-width: 700px) {
    display: none;
  }
`;

const CarouselContainer = styled.div`
  position: absolute;
  background: #f5f6f6;
  top: 81px;
  left: 0;
  width: 500px;
`;

const Header = (props) => {
  return (
    <HeaderContainer {...props}>
      <TopRow>
        <RoomIcon src={RoomLogo} alt="Room logo" />
        <IconContainer>
          <a href="https://soundcloud.com/room-haus" target="_blank" rel="noopener noreferrer">
            <img src={SoundCloudIcon} alt="https://soundcloud.com/room-haus" />
          </a>
          <a href="https://www.instagram.com/room.haus/" target="_blank" rel="noopener noreferrer">
            <img src={InstagramIcon} alt="https://instagram.com/room.haus/" />
          </a>
        </IconContainer>
        <TactileContainer>
          <Tactile />
          <Tactile />
          <Tactile />
        </TactileContainer>
      </TopRow>
      <MousePositionContext.Consumer>
        {({y}) => (
          <BottomRow position={y}>
            <PageDescription>Latest Mixes on Room</PageDescription>
            <HeaderPlayer />
            <CarouselContainer>
              <MixCarousel slidesToShow={5} navigate />
            </CarouselContainer>
          </BottomRow>
        )}
      </MousePositionContext.Consumer>
    </HeaderContainer>
  );
};

export default Header;
