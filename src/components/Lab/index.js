import React from 'react';
import styled from 'styled-components';
import Oscilliscope from '../../audio/visualizations/Oscilliscope';
import PlayToggle from './PlayToggle';
import MetaInfo from './MetaInfo';
import ODFMetaGraph from './ODFMetaGraph';

const DashboardGrid = styled.div`
  display: grid;
  width: 100vw;
  height: 100%;
  margin: auto;
  padding: 0;
  background: ${({beat}) => (beat ? '#FF99AA' : 'inherit')};
  grid-template-columns: repeat(20, 5%);
  grid-template-rows: repeat(20, 5%);
  & > * {
    box-sizing: border-box;
    border: 1px black solid;
  }
`;

const OscilliscopeView = styled(Oscilliscope)`
  grid-column: 13 / span 3;
`;

const PlayButton = styled(PlayToggle)`
  grid-column: 11 / span 2;
`;

const MetaInfoLabels = styled(MetaInfo)`
  grid-column: 2 / span 8;
`;

const ODFGraph = styled(ODFMetaGraph)`
  grid-column: 2 / span 18;
  grid-row: 2 / span 6;
`;

class LabDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      beat: false,
    };
  }

  setBeat = () => {
    const {beat} = this.state;
    if (!beat) {
      // this.setState({beat: true}, () => {
      //   setTimeout(() => this.setState({beat: false}), 100);
      // });
    }
  };

  render() {
    const {source} = this.props;
    const {beat} = this.state;
    return (
      <DashboardGrid beat={beat}>
        <MetaInfoLabels source={source} />
        <PlayButton source={source} />
        <OscilliscopeView source={source} />
        <ODFGraph source={source} onBeat={this.setBeat} />
      </DashboardGrid>
    );
  }
}

export default LabDashboard;
