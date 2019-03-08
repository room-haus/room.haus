/* eslint-disable */
import KissFFTModule from './KissFFT.js';

export const Module = KissFFTModule({});

const kiss_fftr_alloc = Module.cwrap('kiss_fftr_alloc', 'number', ['number', 'number', 'number', 'number']);

const kiss_fftr = Module.cwrap('kiss_fftr', 'void', ['number', 'number', 'number']);

const kiss_fftri = Module.cwrap('kiss_fftri', 'void', ['number', 'number', 'number']);

const kiss_fftr_free = Module.cwrap('kiss_fftr_free', 'void', ['number']);

const kiss_fft_alloc = Module.cwrap('kiss_fft_alloc', 'number', ['number', 'number', 'number', 'number']);

const kiss_fft = Module.cwrap('kiss_fft', 'void', ['number', 'number', 'number']);

const kiss_fft_free = Module.cwrap('kiss_fft_free', 'void', ['number']);

export const FFT = function(size) {
  this.size = size;
  this.fcfg = kiss_fft_alloc(size, false);
  this.icfg = kiss_fft_alloc(size, true);

  this.inptr = Module._malloc(size * 8 + size * 8);
  this.outptr = this.inptr + size * 8;

  this.cin = new Float32Array(Module.HEAPU8.buffer, this.inptr, size * 2);
  this.cout = new Float32Array(Module.HEAPU8.buffer, this.outptr, size * 2);

  this.forward = function(cin) {
    this.cin.set(cin);
    kiss_fft(this.fcfg, this.inptr, this.outptr);
    return new Float32Array(Module.HEAPU8.buffer, this.outptr, this.size * 2);
  };

  this.inverse = function(cin) {
    this.cin.set(cpx);
    kiss_fft(this.icfg, this.inptr, this.outptr);
    return new Float32Array(Module.HEAPU8.buffer, this.outptr, this.size * 2);
  };

  this.dispose = function() {
    Module._free(this.inptr);
    kiss_fft_free(this.fcfg);
    kiss_fft_free(this.icfg);
  };
};

export const FFTR = function(size) {
  this.size = size;
  this.fcfg = kiss_fftr_alloc(size, false);
  this.icfg = kiss_fftr_alloc(size, true);

  this.rptr = Module._malloc(size * 4 + (size + 2) * 4);
  this.cptr = this.rptr + size * 4;

  this.ri = new Float32Array(Module.HEAPU8.buffer, this.rptr, size);
  this.ci = new Float32Array(Module.HEAPU8.buffer, this.cptr, size + 2);

  this.forward = function(real) {
    this.ri.set(real);
    kiss_fftr(this.fcfg, this.rptr, this.cptr);
    return new Float32Array(Module.HEAPU8.buffer, this.cptr, this.size + 2);
  };

  this.inverse = function(cpx) {
    this.ci.set(cpx);
    kiss_fftri(this.icfg, this.cptr, this.rptr);
    return new Float32Array(Module.HEAPU8.buffer, this.rptr, this.size);
  };

  this.dispose = function() {
    Module._free(this.rptr);
    kiss_fftr_free(this.fcfg);
    kiss_fftr_free(this.icfg);
  };
};
