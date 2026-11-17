export default class BPMDetectorWorkletNode {
  constructor(context, onOnset) {
    this.context = context;
    this.onOnset = onOnset;
  }

  async attach(source) {
    await this.context.audioWorklet.addModule('/worklets/index.js');
    if (this.closed) return;
    this.node = new AudioWorkletNode(this.context, 'onset-detector-processor');
    this.filter = this.context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 100;
    this.source = source;
    source.connect(this.filter);
    this.filter.connect(this.node);
    // The processor leaves its output silent. Media has its own audible output.
    this.node.connect(this.context.destination);
    this.node.port.onmessage = () => this.onOnset();
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    if (this.node) {
      this.node.port.postMessage('stop');
      this.node.port.close();
      this.node.disconnect();
    }
    this.filter?.disconnect();
    if (this.source) this.source.disconnect(this.filter);
  }
}
