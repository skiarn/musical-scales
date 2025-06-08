import { computeFFT } from './fft';
import { trackFrequencyBand, detectTrend } from './signal-processing';

export type FrequencyBand = {
  name: string;
  minFreq: number;
  maxFreq: number;
};

export const analyzeFrequencyBands = (
  timeSeriesData: { x: number; y: number }[][],  // Array of time windows
  sampleRate: number,
  bands: FrequencyBand[]
) => {
  // Compute FFT for each time window
  const fftFrames = timeSeriesData.map(frame => 
    computeFFT(frame, sampleRate)
  );

  // Track energy for each frequency band
  const bandEnergies = bands.map(band => ({
    name: band.name,
    energies: trackFrequencyBand(fftFrames, band.minFreq, band.maxFreq),
    trend: null as string | null
  }));

  // Detect trends for each band
  bandEnergies.forEach(band => {
    band.trend = detectTrend(band.energies, 0.1);
  });

  return bandEnergies;
};

// Example frequency bands for music analysis
export const commonFrequencyBands: FrequencyBand[] = [
  { name: 'Bass', minFreq: 20, maxFreq: 150 },
  { name: 'Low-Mids', minFreq: 150, maxFreq: 400 },
  { name: 'Mids', minFreq: 400, maxFreq: 2000 },
  { name: 'High-Mids', minFreq: 2000, maxFreq: 6000 },
  { name: 'Highs', minFreq: 6000, maxFreq: 20000 },
];
