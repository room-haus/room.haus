import React from 'react';
import AudioMetaContext from './AudioMetaContext';
import HLSAudioSource from '../../../audio/HLSAudioSource';

export const Context = React.createContext({
  source: undefined,
  set: () => void 0,
});

class AudioSourceContext extends React.Component {
  static Provider = Context.Provider;
  static Consumer = Context.Consumer;
  static cache = {};

  constructor(props) {
    super(props);

    this.state = {
      source: null,
      set: this.setSource.bind(this),
    };
  }

  componentWillUnmount() {
    const source = this.state.source;
    source && source.pause();
  }

  getOrCreate(trackId) {
    if (!trackId) {
      throw Error("Can't make source without track ID");
    }
    // if (this.state.source) {
    //   const {id} = this.state.source;
    //   AudioSourceContext.cache[id].dispose();
    //   delete AudioSourceContext.cache[id];
    // }
    if (!AudioSourceContext.cache[trackId]) {
      AudioSourceContext.cache[trackId] = new HLSAudioSource({id: trackId});
    }
    return AudioSourceContext.cache[trackId];
  }

  setSource(id) {
    const source = this.getOrCreate(id);
    this.setState({source});
  }

  meta() {
    const {source} = this.state;
    return source ? source.getMeta() : {};
  }

  render() {
    return (
      <AudioSourceContext.Provider value={this.state}>
        <AudioMetaContext source={this.state.source}>{this.props.children}</AudioMetaContext>
      </AudioSourceContext.Provider>
    );
  }
}

export default AudioSourceContext;
