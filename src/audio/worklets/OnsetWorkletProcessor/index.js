// Detect changes in low-band energy over fixed sample windows. Publish only onsets
// so the renderer never needs to poll the worklet or allocate an FFT per audio frame.
class OnsetDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = 0;
    this.energy = 0;
    this.lastEnergy = 0;
    this.baseline = 0;
    this.cooldown = 0;
    this.stopped = false;
    this.port.onmessage = ({data}) => { if (data === 'stop') this.stopped = true; };
  }

  process(inputs) {
    if (this.stopped) return false;
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.energy += sample * sample;
      if (++this.samples < 512) continue;
      const rise = Math.max(0, this.energy - this.lastEnergy);
      if (rise > Math.max(0.005, this.baseline * 2.5) && this.cooldown === 0) {
        this.port.postMessage(true);
        this.cooldown = 10;
      }
      this.cooldown = Math.max(0, this.cooldown - 1);
      this.baseline = this.baseline * 0.9 + rise * 0.1;
      this.lastEnergy = this.energy;
      this.energy = this.samples = 0;
    }
    return true;
  }
}

registerProcessor('onset-detector-processor', OnsetDetector);
