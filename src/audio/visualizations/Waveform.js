import React from 'react';
import {summarize} from "../utils"

export default class Waveform extends React.Component {
    constructor(props) {
        super(props);
        this.barWidth = 3;
        this.barMargin = 1;
        this.color = this.props.color || "black";

        this.waveformData = [];
        this.container = React.createRef();
    }

    refresh = () => {
        this.setDimensions();
        this.calculateWaveformData();
    }

    setDimensions = () => {
        const container = this.container.current;
        const {height, width} = container.getBoundingClientRect();
        this.height = height;
        this.width = width;
    }

    calculateWaveformData = () => {
        const waveformData = summarize(this.width/(this.barWidth + this.barMargin), this.props.audioData)
        this.waveformData = waveformData;
    }

    componentDidMount() {
        this.refresh();
        window.addEventListener("onresize", this.refresh);
    }

    componentWillUnmount() {
        window.removeEventListener("onresize", this.refresh);
    }

    waveformColor = (index) => {
        const length = this.waveformData.length;
        const percentage = length ? index/length : 0;
        return percentage < this.props.playheadLocation
            ? this.props.progressColor : this.props.color;
    }

    getWaveBar = (data, i) => {
        const multiplier = this.height/2;
        const attrs = {
            key: `wfBar${i}`,
            fill: this.waveformColor(i),
            width: this.barWidth,
            height: multiplier*(data[1] - data[0]),
            x: i * (this.barWidth + this.barMargin),
            y: multiplier - (multiplier * data[1]),
        }
        return <rect {...attrs} />
    }

    render() {
        return (
            <svg ref={this.container} style={{height: '100%', width: '100%'}}>
                {this.waveformData.map(this.getWaveBar)}
            </svg>
        );
    }
}
