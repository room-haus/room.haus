import React from 'react';
import {throttle} from 'lodash';

const Context = React.createContext({
  x: 0,
  y: 0,
});

class MousePositionContext extends React.Component {
  static Provider = Context.Provider;
  static Consumer = Context.Consumer;

  constructor(props) {
    super(props);
    this._updateMousePosition = throttle((event) => {
      this.setState({
        x: event.pageX,
        y: event.pageY,
      });
    }, 100);

    this.updateMousePosition = (event) => {
      event.persist();
      this._updateMousePosition(event);
    };
    this.updateMousePosition = this.updateMousePosition.bind(this);
    this.handleTouch = (event) => {
      this.setState({
        x: event.touches[0].pageX,
        y: event.touches[0].pageY,
      });
    };

    this.state = {
      x: 0,
      y: 0,
    };
  }

  render() {
    return (
      <MousePositionContext.Provider value={this.state}>
        <div
          onMouseMove={this.updateMousePosition}
          onTouchStart={this.handleTouch}>
          {this.props.children}
        </div>
      </MousePositionContext.Provider>
    );
  }
}

export default MousePositionContext;
