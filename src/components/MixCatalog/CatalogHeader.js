import React from 'react';
import styled from 'styled-components';
import {NavLink, Link} from 'react-router-dom';
import {Header, HeaderItem} from 'src/components/layout/Header';
import RoomLogo from 'src/images/logo.png';

const RoomIcon = styled.img`
  object-fit: contain;
  margin: 0;
  width: 92%;
  max-width: 200px;
  @media (min-width: 1200px) {
    padding-right: 5vw;
  }
`;

const NavItems = styled.div`
  font-size: 5vmin;
  width: 100%;
  display: flex;
  justify-content: space-evenly;

  a.active {
    text-decoration: underline;
  }

  a {
    color: inherit;
  }
`;

const SocialLink = styled.a`
  text-decoration: none;
  color: inherit;
  font-size: 1em;
`;

const SocialIcons = styled(HeaderItem)`
  * + * {
    margin-left: 2vw;
  }

  @media (max-width: 700px) {
    * + * {
      margin-left: 0;
    }
    margin: 0;
    padding: 0;
    line-height: 1em;
    display: flex;
    flex-direction: column;
    font-size: 2vw;
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

const Tactiles = () => (
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
        <Link to={({pathname}) => `/${pathname.split('/').filter((x) => x !== '')[0]}/`}>
          <RoomIcon src={RoomLogo} alt="Room logo" />
        </Link>
      </HeaderItem>
      <HeaderItem position="middle">
        {tactile ? (
          <Tactiles />
        ) : (
          <NavItems>
            <NavLink to="/mixes/">
              <span>MIXES</span>
            </NavLink>
            <NavLink to="/releases/">
              <span>RELEASES</span>
            </NavLink>
          </NavItems>
        )}
      </HeaderItem>
      <SocialIcons position="right">
        <SocialLink href="mailto:info@room.haus">email</SocialLink>
        <SocialLink href="https://soundcloud.com/room-haus" target="_blank" rel="noopener noreferrer">
          soundcloud
        </SocialLink>
        <SocialLink href="https://www.instagram.com/room.haus/" target="_blank" rel="noopener noreferrer">
          instagram
        </SocialLink>
      </SocialIcons>
    </Header>
  );
};
