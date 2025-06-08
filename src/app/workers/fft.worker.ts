import { computeFFT, filterFFTData } from '../utils/fft';

self.onmessage = (e: MessageEvent) => {
  const { data, sampleRate, minFreq, maxFreq } = e.data;
  const fftData = computeFFT(data, sampleRate);
  const filteredFFT = filterFFTData(fftData, sampleRate, minFreq, maxFreq);
  self.postMessage(filteredFFT);
};
