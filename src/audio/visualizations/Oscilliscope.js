import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import {scaleLinear} from 'd3';

const OscilliscopeCanvas = styled.canvas`
  width: 100%;
  height: 100%;
`;

export default class Oscilloscope extends React.Component {
  constructor(props) {
    super(props);
    // this.color = '#131214';
    this.color = '#f5f5f5';
    this.lineWidth = 1;

    this.container = React.createRef();
  }

  componentDidMount() {
    const container = this.container.current;
    const {height, width} = this.container.current.getBoundingClientRect();
    container.width = width;
    container.height = height;
    const canvas = container.getContext('2d');
    canvas.shadowBlur = 3;
    canvas.shadowColor = this.color;

    const render = () => {
      const data = this.props.source ? this.props.source.getTimeDomainData() : [];
      const xScale = scaleLinear()
        .domain([0, data.length])
        .range([0, width]);
      const yScale = scaleLinear()
        .domain([0, 255])
        .range([0, height]);
      canvas.lineWidth = this.lineWidth;
      canvas.fillStyle = this.color;
      canvas.clearRect(0, 0, container.width, container.height);
      canvas.strokeStyle = this.color;
      canvas.beginPath();
      for (let i = 0; i < data.length; i += 1) {
        const x = xScale(i);
        const y = yScale(data[i]);
        if (i === 0) {
          canvas.moveTo(x, y);
        } else {
          canvas.lineTo(x, y);
        }
      }
      canvas.stroke();
      requestAnimationFrame(render.bind(this));
    };
    render.bind(this)();
  }

  render() {
    return <OscilliscopeCanvas innerRef={this.container} />;
  }
}

Oscilloscope.propTypes = {
  source: PropTypes.object,
  height: PropTypes.string,
};
