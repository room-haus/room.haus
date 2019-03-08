import React from 'react';
import styled from 'styled-components';
import MixCarousel from '../MixCarousel';
import RoomLogo from '../../images/logo.png';
import SoundCloudIcon from '../../images/soundcloud-icon.png';
import InstagramIcon from '../../images/instagram-icon.png';

const TopRow = styled.div`
  width: 100%;
  height: 4em;
  position: fixed;
  top: 0;
  background: #f5f6f6;
  display: flex;
  z-index: 2;
  left: 0;
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

const HeaderContainer = styled.header`
  height: ${(props) => (props.hidden ? '5.5em' : '7.3em')};
  width: 100%;
  z-index: 10;
  top: 0;
  background: transparent;
  font-family: 'NeueHaasGrotDisp';
  padding: 0.1em 0.4em;
`;

const CarouselContainer = styled.div`
  position: relative;
  width: 60%;
  margin: auto;
  padding: 0;
`;

const Header = (props) => (
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
      <CarouselContainer>
        <MixCarousel slidesToShow={6} slim />
      </CarouselContainer>
    </TopRow>
  </HeaderContainer>
);

export default Header;
