import React from 'react';
import AudioSourceContext from '../components/contexts/audio/AudioSourceContext';
import FullScreenLabLayout from '../components/Lab/FullScreenLabLayout';
import Lab from '../components/Lab';

const LabPage = () => (
  <FullScreenLabLayout>
    <AudioSourceContext.Consumer>{({source}) => <Lab source={source} />}</AudioSourceContext.Consumer>
  </FullScreenLabLayout>
);

export default LabPage;
