import React from 'react';
import styled from 'styled-components';
import RoomLogo from 'src/images/logo.png';
import SoundCloudIcon from 'src/images/soundcloud-icon.png';
import InstagramIcon from 'src/images/instagram-icon.png';

const RoomIcon = styled.img`
  margin: 0 10px;
  object-fit: contain;
  align-self: center;
`;

const Container = styled.div`
  background: #f5f6f6;
  border-bottom: 1px solid gray;

  display: grid;
  grid-template-columns: minmax(auto, 15vw) minmax(50vw, 1fr) auto;
  grid-template-rows: 7vh;
`;

const SocialIcon = styled.img`
  margin: 0;
  max-height: 40px;
  object-fit: contain;
  display: inline-block;
`;

const RightContainer = styled.div`
  justify-self: end;
  display: inline-flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 10px;

  * + * {
    margin-left: 2vw;
  }
`;

const NavItems = styled.div`
  display: inline-flex;
  justify-content: space-evenly;
  align-items: center;
  margin: 0 10px;
  padding: 0;
  line-height: 0.9em;
  font-family: 'NeueHaasGrotDisp';
  font-size: 3vw;

  span.active {
    border-bottom: solid 3px black;
  }
`;

const Header = () => {
  return (
    <Container>
      <RoomIcon src={RoomLogo} alt="Room logo" />
      <NavItems>
        <span className="active">MIXES</span>
        <span>RELEASES</span>
        <span>TEAM</span>
      </NavItems>
      <RightContainer>
        <SocialIcon src={SoundCloudIcon} alt="SoundCloud" />
        <SocialIcon src={InstagramIcon} alt="Instagram" />
      </RightContainer>
    </Container>
  );
};

export default Header;
