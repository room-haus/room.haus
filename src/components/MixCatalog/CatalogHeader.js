import React from 'react';
import styled from 'styled-components';
import {Header, HeaderItem} from 'src/components/layout/Header';
import RoomLogo from 'src/images/logo.png';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faSoundcloud, faInstagram} from '@fortawesome/free-brands-svg-icons';
import {faEnvelope} from '@fortawesome/free-regular-svg-icons';

const RoomIcon = styled.img`
  object-fit: contain;
  margin: 0;
  width: 40%;
`;

const NavItems = styled.div`
  font-size: 4vw;

  .active {
    border-bottom: solid 3px black;
  }
`;

const StyledIcon = styled(FontAwesomeIcon)`
  font-size: 4vw;
  margin: 0;

  @media screen and (max-width: 1200px) {
    font-size: 5vw;
  }
`;

const Link = styled.a`
  text-decoration: none;
  color: inherit;
`;

const SocialIcons = styled(HeaderItem)`
  * + * {
    margin-left: 1vw;
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

const Tactiles = (
  <TactileContainer>
    <Tactile />
    <Tactile />
    <Tactile />
  </TactileContainer>
);

export default ({tactile}) => {
  return (
    <Header>
      <HeaderItem position="left">
        <Link href="/mixes/">
          <RoomIcon src={RoomLogo} alt="Room logo" />
        </Link>
      </HeaderItem>
      <HeaderItem position="middle">
        {tactile ? (
          Tactiles
        ) : (
          <NavItems>
            <span className="active">MIXES</span>
          </NavItems>
        )}
      </HeaderItem>
      <SocialIcons position="right">
        <Link href="mailto:info@room.haus">
          <StyledIcon icon={faEnvelope} />
        </Link>
        <Link href="https://soundcloud.com/room-haus" target="_blank" rel="noopener noreferrer">
          <StyledIcon icon={faSoundcloud} />
        </Link>
        <Link href="https://www.instagram.com/room.haus/" target="_blank" rel="noopener noreferrer">
          <StyledIcon icon={faInstagram} />
        </Link>
      </SocialIcons>
    </Header>
  );
};
