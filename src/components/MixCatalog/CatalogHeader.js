import React from 'react';
import styled from 'styled-components';
import RoomLogo from 'src/images/logo.png';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSoundcloud, faInstagram} from '@fortawesome/free-brands-svg-icons';
import {faEnvelope} from '@fortawesome/free-regular-svg-icons';

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

const StyledIcon = styled(FontAwesomeIcon)`
  margin: 0;
  font-size: 3vw;
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

  .active {
    border-bottom: solid 3px black;
  }
`;

const Link = styled.a`
  text-decoration: none;
  color: inherit;
`;

const Header = () => {
  return (
    <Container>
      <RoomIcon src={RoomLogo} alt="Room logo" />
      <NavItems>
        <span className="active">MIXES</span>
      </NavItems>
      <RightContainer>
        <Link href="mailto:info@room.haus">
          <StyledIcon icon={faEnvelope} />
        </Link>
        <Link href="https://soundcloud.com/room-haus" target="_blank" rel="noopener noreferrer">
          <StyledIcon icon={faSoundcloud} />
        </Link>
        <Link href="https://www.instagram.com/room.haus/" target="_blank" rel="noopener noreferrer">
          <StyledIcon icon={faInstagram} />
        </Link>
        {/* <SocialIcon src={SoundCloudIcon} alt="SoundCloud" />
        <SocialIcon src={InstagramIcon} alt="Instagram" /> */}
      </RightContainer>
    </Container>
  );
};

export default Header;
