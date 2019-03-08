import React from 'react';

// For ES5 builds, import from 'pts/dist/es5'. For ES6 or custom builds, import from 'pts'.
import {CanvasSpace} from 'pts';

export default class PtsCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.canvRef = React.createRef();
    this.space = null;
    this.form = null;
  }

  componentDidMount() {
    this.init();
    this.buildScene(this.space, this.form);
    this._loop();
  }

  componentDidUpdate() {
    this._loop();
  }

  _loop() {
    if (this.props.loop) {
      this.space.play();
    } else {
      this.space.playOnce(0);
    }
  }

  // Required: Override this to use Pts' player `animate` callback
  // See guide: https://ptsjs.org/guide/space-0500
  animate(time, ftime) {}

  // Optional: Override this to use Pts' player `start` callback
  start(space, bound) {}

  // Optional: Override this to use Pts' player `resize` callback
  resize(size, evt) {}

  // Optional: Override this to use Pts' player `action` callback
  action(type, px, py, evt) {}

  buildScene(space, form) {}

  init() {
    this.space = new CanvasSpace(this.canvRef).setup({
      bgcolor: this.props.background,
      resize: this.props.resize,
      retina: this.props.retina,
    });
    this.form = this.space.getForm();

    this.space.add(this);
    // this.space.bindMouse().bindTouch();
  }

  render() {
    return <canvas ref={(c) => (this.canvRef = c)} />;
  }
}

PtsCanvas.defaultProps = {
  name: 'pt', // maps to className of the container div
  background: '#000',
  resize: true,
  retina: true,
  loop: true,
};
