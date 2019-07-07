import {useEffect} from 'react';

const LandingPage = () => {
  useEffect(() => {
    const {navigate} = require('gatsby'); // eslint-disable-line global-require
    navigate('/mixes/');
  });
  return null;
};

export default LandingPage;
