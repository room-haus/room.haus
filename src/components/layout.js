import React from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import Header from './header';
import Footer from './Footer';
import {ContentContainer} from '../components/containers';
import SiteContainer from '../components/containers/SiteContainer';
import './layout.css';

const Layout = ({children}) => (
  <>
    <Helmet
      title="room.haus"
      meta={[
        {name: 'description', content: 'dope shit'},
        {name: 'keywords', content: 'dope, shit'},
      ]}
    />
    <SiteContainer>
      <Header />
      <ContentContainer>{children}</ContentContainer>
      <Footer />
    </SiteContainer>
  </>
);

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
