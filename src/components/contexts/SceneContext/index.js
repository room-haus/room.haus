import React from 'react';

const Context = React.createContext({
  loading: false,
  loaded: false,
  startLoading: () => void 0,
  endLoading: () => void 0,
});

class SceneContext extends React.Component {
  static Provider = Context.Provider;
  static Consumer = Context.Consumer;

  constructor(props) {
    super(props);

    const startLoading = () => {
      this.setState({
        loading: true,
        loaded: false,
      });
    };
    const endLoading = () => {
      this.setState({
        loading: false,
        loaded: true,
      });
    };

    this.state = {
      loading: false,
      loaded: false,
      startLoading,
      endLoading,
    };
  }

  render() {
    return (
      <SceneContext.Provider value={this.state}>
        {this.props.children}
      </SceneContext.Provider>
    );
  }
}

export default SceneContext;
