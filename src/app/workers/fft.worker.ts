import { computeFFT } from '../utils/fft';

self.onmessage = (e: MessageEvent) => {
  const { data, sampleRate, minFreq, maxFreq } = e.data;

  try {
    // Initial progress
    self.postMessage({ type: 'progress', progress: 5, status: 'starting' });

    const fftData = computeFFT(data, sampleRate);
    self.postMessage({ type: 'progress', progress: 40, status: 'fft_done', bins: fftData.length });

    // Perform filtering in chunks so we can report progress
    const total = fftData.length;
    const amplitudes = fftData.map(p => ({ frequency: p.frequency, amplitude: p.amplitude }));
    const chunkSize = 256;
    let idx = 0;

    const processChunk = () => {
      const end = Math.min(total, idx + chunkSize);
      for (; idx < end; idx++) {
        if (amplitudes[idx].frequency < minFreq || amplitudes[idx].frequency > maxFreq) {
          amplitudes[idx].amplitude = 0;
        }
      }
      const prog = 40 + Math.round((idx / total) * 55); // progress from 40 -> 95
      self.postMessage({ type: 'progress', progress: Math.min(prog, 95), status: 'filtering', index: idx });
      if (idx < total) {
        // schedule next chunk
        setTimeout(processChunk, 0);
      } else {
        // done
        self.postMessage({ type: 'progress', progress: 100, status: 'done' });
        self.postMessage({ type: 'result', filteredFFT: { amplitudes }, minFreq, maxFreq });
      }
    };

    processChunk();
  } catch (err) {
    self.postMessage({ type: 'error', message: (err && (err as Error).message) || 'Unknown error' });
  }
};
