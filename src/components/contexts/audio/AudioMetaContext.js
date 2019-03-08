import React from 'react';
import {isEqual} from 'lodash';

const defaultState = {
  time: null,
  loadProgress: null,
  isPlaying: false,
  isReady: false,
  isLoading: false,
  playheadLocation: null,
  meta: {},
};

const Context = React.createContext({...defaultState});

class AudioMetaContext extends React.Component {
  static Provider = Context.Provider;
  static Consumer = Context.Consumer;

  constructor(props) {
    super(props);

    this.state = {...defaultState};
  }

  componentDidUpdate() {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        const {source} = this.props;
        const currMeta = source ? source.getMeta() : null;
        if (!this.unmounting && !isEqual(this.prevMeta, currMeta)) {
          this.prevMeta = currMeta;
          this.setState(currMeta);
        }
      }, 250);
    }
  }

  componentWillUnmount() {
    this.unmounting = true;
    clearInterval(this.intervalId);
  }

  render() {
    return (
      <AudioMetaContext.Provider value={this.state}>
        {this.props.children}
      </AudioMetaContext.Provider>
    );
  }
}

export default AudioMetaContext;
