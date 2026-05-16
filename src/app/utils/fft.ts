"use client";

import { applyMovingAverage, applyHanningWindow } from './signal-processing';

// ---------------------------------------------------------------------------
// Core FFT / IFFT primitives
// ---------------------------------------------------------------------------

/**
 * Cooley-Tukey radix-2 Decimation-In-Time FFT (recursive, in-place).
 * Input arrays must have a power-of-2 length.
 *
 * After calling this function:
 *   real[k] + j·imag[k]  =  Σ_{n=0}^{N-1} x[n] · e^{-j·2π·k·n/N}
 *
 * @param real  Real parts of the input signal (mutated in place).
 * @param imag  Imaginary parts (zero for purely real signals).
 */
function radix2FFT(real: number[], imag: number[]): void {
  const n = real.length;
  if (n <= 1) return;

  const evenReal = new Array(n / 2);
  const evenImag = new Array(n / 2);
  const oddReal  = new Array(n / 2);
  const oddImag  = new Array(n / 2);

  for (let i = 0; i < n / 2; i++) {
    evenReal[i] = real[i * 2];
    evenImag[i] = imag[i * 2];
    oddReal[i]  = real[i * 2 + 1];
    oddImag[i]  = imag[i * 2 + 1];
  }

  radix2FFT(evenReal, evenImag);
  radix2FFT(oddReal,  oddImag);

  for (let i = 0; i < n / 2; i++) {
    const t    = -2 * Math.PI * i / n;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const realT = cosT * oddReal[i] - sinT * oddImag[i];
    const imagT = sinT * oddReal[i] + cosT * oddImag[i];
    real[i]         = evenReal[i] + realT;
    imag[i]         = evenImag[i] + imagT;
    real[i + n / 2] = evenReal[i] - realT;
    imag[i + n / 2] = evenImag[i] - imagT;
  }
}

/**
 * Inverse FFT (in-place).
 * Uses the identity: IFFT(X) = conj(FFT(conj(X))) / N
 *
 * @param real  Real parts of the frequency-domain input (mutated in place).
 * @param imag  Imaginary parts of the frequency-domain input (mutated in place).
 */
function ifft(real: number[], imag: number[]): void {
  const n = real.length;
  // Step 1: conjugate
  for (let i = 0; i < n; i++) imag[i] = -imag[i];
  // Step 2: forward FFT
  radix2FFT(real, imag);
  // Step 3: conjugate and scale by 1/N
  for (let i = 0; i < n; i++) {
    real[i] /= n;
    imag[i] = -imag[i] / n;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const computeFFT = (data: { x: number, y: number }[], sampleRate: number) => {
  // Pre-process the signal
  const smoothedData = applyMovingAverage(data, 3);
  const windowedData = applyHanningWindow(smoothedData);

  const N = windowedData.length;

  // Find the next power of 2
  const paddedLength = 2 ** Math.ceil(Math.log2(N));

  // Pad the real part with zeros
  const real = new Array(paddedLength).fill(0).map((_, i) => i < N ? windowedData[i].y : 0);
  const imag = new Array(paddedLength).fill(0);

  radix2FFT(real, imag);

  const fftData = Array.from({ length: paddedLength / 2 }, (_, i) => ({
    frequency: i * sampleRate / paddedLength, // Correct frequency calculation
    amplitude: Math.sqrt(real[i] ** 2 + imag[i] ** 2) / paddedLength,
  }));

  return fftData.slice(0, N / 2); // Return the first N / 2 elements
};

/**
 * Applies a low-pass or high-pass filter to a time-domain signal.
 *
 * ## Algorithm
 * 1. Zero-pad the signal to the next power of 2 and compute its FFT.
 * 2. For each frequency bin k (frequency f_k = k · fs / N), compute a
 *    sigmoid gain that smoothly rolls off around the cutoff frequency f_c:
 *
 *      Low-pass:   G[k] = 1 / (1 + exp( α · (f_k − f_c)))   → 1 below f_c, 0 above
 *      High-pass:  G[k] = 1 / (1 + exp(−α · (f_k − f_c)))   → 0 below f_c, 1 above
 *
 *    where α = 20 / f_c controls the steepness of the transition band.
 *    A sigmoid is used instead of a hard cutoff to avoid Gibbs ringing
 *    artefacts in the reconstructed waveform.
 * 3. Conjugate symmetry is preserved by mapping negative-frequency bins
 *    (k > N/2) back to their positive-frequency counterpart.
 * 4. Apply the IFFT to reconstruct the filtered time-domain signal.
 * 5. Trim back to the original signal length and pair with the original x values.
 *
 * This is a **display-only** filter — the original data array is never mutated.
 *
 * @param data      Input time-domain samples as `{x, y}[]`.
 * @param sampleRate Sample rate in Hz (used to convert bin indices to Hz).
 * @param type      `'lowpass'` removes high frequencies; `'highpass'` removes low frequencies.
 * @param cutoffHz  Cutoff frequency in Hz.
 * @returns Filtered time-domain samples as `{x, y}[]` with the same length as input.
 */
export function applyFrequencyFilter(
  data: { x: number; y: number }[],
  sampleRate: number,
  type: 'lowpass' | 'highpass',
  cutoffHz: number,
): { x: number; y: number }[] {
  const N = data.length;
  if (N === 0) return data;

  const paddedLength = 2 ** Math.ceil(Math.log2(Math.max(N, 2)));

  const real = new Array(paddedLength).fill(0).map((_, i) => i < N ? data[i].y : 0);
  const imag = new Array(paddedLength).fill(0);

  radix2FFT(real, imag);

  // α controls the sigmoid steepness; ~20/f_c gives a smooth transition band
  const alpha = 20 / Math.max(cutoffHz, 1);

  for (let k = 0; k < paddedLength; k++) {
    // Map bin k to its positive frequency (handles conjugate-symmetric negative bins)
    const freq = k <= paddedLength / 2
      ? k * sampleRate / paddedLength
      : (paddedLength - k) * sampleRate / paddedLength;

    const gain = type === 'lowpass'
      ? 1 / (1 + Math.exp(alpha * (freq - cutoffHz)))
      : 1 / (1 + Math.exp(-alpha * (freq - cutoffHz)));

    real[k] *= gain;
    imag[k] *= gain;
  }

  ifft(real, imag);

  return data.map((point, i) => ({ x: point.x, y: real[i] }));
}

export const transformFFTData = (dataFFT: { frequency: number; amplitude: number }[]) => {
  return dataFFT.map(d => ({
    x: d.frequency,
    y: d.amplitude,
  }));
};

export const filterFFTData = (fftData: { frequency: number; amplitude: number }[], sampleRate: number, minFreq: number, maxFreq: number) => {
  // Create an output array that preserves the original bin indices/length
  // but sets amplitudes to 0 for frequencies outside the requested band.
  const amplitudes = fftData.map(point => {
    if (point.frequency >= minFreq && point.frequency <= maxFreq) {
      return { frequency: point.frequency, amplitude: point.amplitude };
    }
    return { frequency: point.frequency, amplitude: 0 };
  });

  return {
    frequencies: amplitudes.map(point => point.frequency),
    amplitudes // array of { frequency, amplitude } with out-of-band amplitudes zeroed
  };
};

