"use client";

export const computeFFT = (data: { x: number, y: number }[], sampleRate: number) => {
  const N = data.length;
  
  // Find the next power of 2
  const paddedLength = 2 ** Math.ceil(Math.log2(N));

  // Pad the real part with zeros
  const real = new Array(paddedLength).fill(0).map((_, i) => i < N ? data[i].y : 0);
  const imag = new Array(paddedLength).fill(0);

  const fft = (real: number[], imag: number[]) => {
    const n = real.length;
    if (n <= 1) return;

    const evenReal = new Array(n / 2);
    const evenImag = new Array(n / 2);
    const oddReal = new Array(n / 2);
    const oddImag = new Array(n / 2);

    for (let i = 0; i < n / 2; i++) {
      evenReal[i] = real[i * 2];
      evenImag[i] = imag[i * 2];
      oddReal[i] = real[i * 2 + 1];
      oddImag[i] = imag[i * 2 + 1];
    }

    fft(evenReal, evenImag);
    fft(oddReal, oddImag);

    for (let i = 0; i < n / 2; i++) {
      const t = -2 * Math.PI * i / n;
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const realT = cosT * oddReal[i] - sinT * oddImag[i];
      const imagT = sinT * oddReal[i] + cosT * oddImag[i];
      real[i] = evenReal[i] + realT;
      imag[i] = evenImag[i] + imagT;
      real[i + n / 2] = evenReal[i] - realT;
      imag[i + n / 2] = evenImag[i] - imagT;
    }
  };

  fft(real, imag);

  const fftData = Array.from({ length: paddedLength / 2 }, (_, i) => ({
    frequency: i * sampleRate / paddedLength, // Correct frequency calculation
    amplitude: Math.sqrt(real[i] ** 2 + imag[i] ** 2) / paddedLength,
  }));

  return fftData.slice(0, N / 2); // Return the first N / 2 elements
};

  
  export const transformFFTData = (dataFFT: { frequency: number; amplitude: number }[]) => {
    return dataFFT.map(d => ({
      x: d.frequency,
      y: d.amplitude,
    }));
  };
  
 export const filterFFTData = (fftData: { frequency: number; amplitude: number }[], sampleRate: number, minFreq: number, maxFreq:number) => {
  const numPoints = fftData.length; 
  const frequencies = Array.from({ length: numPoints }, (_, i) => i * sampleRate / numPoints); 
  const filteredData = fftData.filter((_, i) => frequencies[i] >= minFreq && frequencies[i] <= maxFreq);

  return { 
    frequencies: frequencies.filter(f => f >= minFreq && f <= maxFreq), 
    amplitudes: filteredData
  };
 }