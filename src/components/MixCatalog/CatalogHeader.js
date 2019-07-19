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
  width: 50%;
  max-width: 200px;
`;

const NavItems = styled.div`
  font-size: 5vmin;
`;

const StyledIcon = styled(FontAwesomeIcon)`
  font-size: 3vmin;
  margin: 0;
`;

const Link = styled.a`
  text-decoration: none;
  color: inherit;
`;

const SocialIcons = styled(HeaderItem)`
  * + * {
    margin-left: 2vw;
  }
`;

const TactileContainer = styled.div`
  width: 20vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: auto;
`;

const Tactile = styled.div`
  border: 1px solid #939296;
  height: 4px;
  width: 100%;

  & + & {
    margin-top: 3px;
  }
`;

const StyledHeader = styled(Header)`
  min-height: 30px;
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
    <StyledHeader>
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
            <span>MIXES</span>
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
    </StyledHeader>
  );
};
