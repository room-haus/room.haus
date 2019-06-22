import React from 'react';
import styled from 'styled-components';
import RoomLogo from 'src/images/logo.png';
import SoundCloudIcon from 'src/images/soundcloud-icon.png';
import InstagramIcon from 'src/images/instagram-icon.png';

const RoomIcon = styled.img`
  margin: 0;
  align-self: center;
`;

const Container = styled.div`
  background: #f5f6f6;
  display: grid;
  grid-template-columns: minmax(auto, 15vw) minmax(50vw, 1fr) auto;
  grid-template-rows: minmax(50px, 7vh);
  border-bottom: 1px solid gray;
  font-family: 'NeueHaasGrotDisp';
`;

const SocialIcon = styled.img`
  margin: 0;
  max-width: 30%;
  max-height: 60px;
  display: inline-block;
`;

const RightContainer = styled.div`
  justify-self: end;
  display: inline-flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 10px;

  * + * {
    margin-left: 5px;
  }
`;

const NavItems = styled.div`
  display: inline-flex;
  justify-content: space-evenly;
  align-items: center;
  margin: 0 10px;
`;

const Header = () => {
  return (
    <Container>
      <RoomIcon src={RoomLogo} alt="Room logo" />
      <NavItems>
        <span>Mixes</span>
        <span>Releases</span>
        <span>Team</span>
      </NavItems>
      <RightContainer>
        <SocialIcon src={SoundCloudIcon} alt="SoundCloud" />
        <SocialIcon src={InstagramIcon} alt="Instagram" />
      </RightContainer>
    </Container>
  );
};

export default Header;
