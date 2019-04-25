import React from 'react';

import FullScreenLayout from '../components/FullScreenLayout';
import SplashScreen from '../components/SplashScreen';

class LandingPage extends React.Component {
  componentDidMount() {
    const {navigate} = require('gatsby'); // eslint-disable-line global-require
    navigate('/mixes/?mx=MX029');
  }
  render() {
    return (
      <FullScreenLayout>
        <SplashScreen />
      </FullScreenLayout>
    );
  }
}

export default LandingPage;
