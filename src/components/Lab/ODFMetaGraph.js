import React from 'react';
import styled from 'styled-components';
import {active, area, axisLeft, easeLinear, line, scaleLinear, select} from 'd3';
// import ODFMetaContext from '../contexts/audio/ODFMetaContext';

const GraphContainer = styled.svg`
  /* width: 900px;
  height: 400px; */
`;

class ODFMetaGraph extends React.Component {
  constructor(props) {
    super(props);
    this.container = React.createRef();
    this.thresholds = [];
    this.odfs = [];
    this.peakMarkers = [];
    this.data = [];
    // this.data = [
    //   {
    //     id: 'thresholds',
    //     color: 'hsl(140, 42%, 58%)',
    //     data: [],
    //   },
    //   {
    //     id: 'onset detection',
    //     color: 'hsl(140, 3%, 19%)',
    //     data: [],
    //   },
    // ];
    this.MAX_FRAMES = 500;
  }

  componentDidMount() {
    const svg = select(this.container.current);
    const svgHeight = 400;
    const svgWidth = 900;
    svg.attr('height', svgHeight).attr('width', svgWidth);
    // this.data = [...new Array(500)].fill(0).map(() => ({odf: Math.random()}));

    const margin = {top: 20, right: 20, bottom: 20, left: 40};
    const width = svg.attr('width') - margin.left - margin.right;
    const height = svg.attr('height') - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const {data} = this;

    const x = scaleLinear()
      .domain([0, this.MAX_FRAMES - 1])
      .range([0, width]);
    // const range = extent(this.data, (d) => d.odf);
    const y = scaleLinear()
      .domain([0, 2])
      .range([height, 0]);
    const odfLine = line()
      .defined((d) => d.spectralDiff !== undefined)
      .x((d, i) => x(i))
      .y((d) => y(d.spectralDiff));
    const thresholdLine = line()
      .defined((d) => d.threshold !== undefined)
      .x((d, i) => x(i))
      .y((d) => y(d.threshold));
    const odfArea = area()
      .x((d, i) => x(i))
      .y0(height)
      .y1((d) => y(d.spectralDiff));

    g.append('defs')
      .append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    // g.append('g')
    //   .attr('tranform', `translate(0,-${y(0)})`)
    //   .call(axisBottom(x));
    const yAxis = axisLeft(y);
    g.append('g').call(yAxis);

    const clipPath = g.append('g').attr('clip-path', 'url(#clip)');
    function update() {
      clipPath
        .select('path.odf-line')
        .attr('d', odfLine)
        .attr('transform', null);

      clipPath
        .select('path.odf-area')
        .attr('d', odfArea)
        .attr('transform', null);

      clipPath.select('path.threshold-line').attr('d', thresholdLine);

      // select('g.onset-markers')
      //   .attr('transform', `translate(${x(-1)},0)`)
      //   .transition();

      active(this)
        .attr('transform', `translate(${x(-1)},0)`)
        .transition()
        .on('start', update);
    }

    clipPath
      .append('path')
      .attr('class', 'odf-line')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#606d72')
      .attr('stroke-width', '3px');

    clipPath
      .append('path')
      .attr('class', 'threshold-line')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#67C185')
      .attr('stroke-width', '5px');

    clipPath
      .append('path')
      .attr('class', 'odf-area')
      .datum(data)
      .attr('fill', '#7e8f96');

    clipPath
      .transition()
      .duration(10)
      .ease(easeLinear)
      .on('start', update);

    // const rectWidth = width / this.MAX_FRAMES;
    // const markers = clipPath.append('g').attr('class', 'onset-markers');
    // this.onsetMarkers = () => {
    //   markers
    //     .selectAll('rect')
    //     .data(this.peakMarkers)
    //     .enter()
    //     .append('rect')
    //     .attr('fill', 'tomato')
    //     .attr('height', height)
    //     .attr('width', rectWidth)
    //     .attr('y', 0)
    //     .attr('x', (d) => x(d))
    //     .exit()
    //     .remove();
    // };
  }

  componentDidUpdate(prevProps) {
    const {source, onBeat} = this.props;
    const {source: prevSource} = prevProps;
    if (source && (!prevSource || prevSource.id !== source.id)) {
      source.setODFUpdateCallback(({threshold, odf, spectralDiff, isPreviousPeak}) => {
        if (!source.isPlaying()) {
          return;
        }
        if (isPreviousPeak) {
          onBeat && onBeat();
          this.peakMarkers.push(this.data.length - 1);
          this.data[this.data.length - 1].onset = true;
          // this.onsetMarkers();
        }
        this.data.push({odf, threshold, spectralDiff, onset: false});
        if (this.data.length > this.MAX_FRAMES) {
          if (this.data[0].onset) {
            this.peakMarkers.shift();
          }
          this.data.shift();
        }
      });
    }
  }

  render() {
    const {className} = this.props;
    return <GraphContainer className={className} innerRef={this.container} />;
  }
}

export default ODFMetaGraph;
