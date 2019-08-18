const ENERGY = 'ENERGY';
const SPECTRAL_DIFFERENCE = 'SPECTRAL_DIFFERENCE';

export default class BPMDetectorWorkletNode {
  constructor(context, onMessage, {cpuCores = 1} = {}) {
    this.context = context;
    this.mode = cpuCores > 4 ? SPECTRAL_DIFFERENCE : ENERGY;
    this.onMessage = onMessage || function() {};
    this.filteredInputs = {
      analyser: context.createAnalyser(),
      low: context.createBiquadFilter(),
      mid: context.createBiquadFilter(),
      high: context.createBiquadFilter(),
    };
    this.filteredInputs.low.type = 'lowpass';
    this.filteredInputs.low.frequency.value = 100;
    this.filteredInputs.mid.type = 'bandpass';
    this.filteredInputs.mid.Q.value = 1;
    this.filteredInputs.mid.frequency.value = 1000;
    this.filteredInputs.high.type = 'highpass';
    this.filteredInputs.high.frequency.value = 10000;
  }

  async init() {
    await this.context.audioWorklet.addModule('/worklets/index.js');
    this.node = new AudioWorkletNode(this.context, 'onset-detector-processor', {
      numberOfInputs: 4,
      processorOptions: {
        mode: this.mode,
      },
    });
    Object.values(this.filteredInputs).forEach((input, index) => input.connect(this.node, 0, index));
    this.node.connect(this.context.destination);
    this.node.port.onmessage = (event) => {
      const {data} = event;
      if (data.debug) {
        console.log(event.data);
      }
      if (data.isPreviousPeak && this.onsetCallback) {
        this.onsetCallback(data);
      }
      this.onMessage(data);
    };
  }

  attach(source) {
    Object.values(this.filteredInputs).forEach((input) => source.connect(input));
  }
}
