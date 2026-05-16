export type TimeSeriesPoint = { x: number, y: number };

// Apply moving average to reduce noise
export const applyMovingAverage = (data: TimeSeriesPoint[], windowSize: number): TimeSeriesPoint[] => {
    const result: TimeSeriesPoint[] = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - windowSize); j < Math.min(data.length, i + windowSize + 1); j++) {
            sum += data[j].y;
            count++;
        }
        result.push({ x: data[i].x, y: sum / count });
    }
    return result;
};

// Apply Hanning window to reduce spectral leakage
export const applyHanningWindow = (data: TimeSeriesPoint[]): TimeSeriesPoint[] => {
    return data.map((point, i) => ({
        x: point.x,
        y: point.y * (0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1))))
    }));
};

// Track frequency band energy over time
export const trackFrequencyBand = (
    fftResults: { frequency: number, amplitude: number }[][],
    minFreq: number,
    maxFreq: number
): number[] => {
    return fftResults.map(fftFrame => {
        const bandData = fftFrame.filter(point =>
            point.frequency >= minFreq && point.frequency <= maxFreq
        );
        return bandData.reduce((sum, point) => sum + point.amplitude, 0) / bandData.length;
    });
};

// Detect significant changes in frequency band
export const detectTrend = (energies: number[], threshold: number): 'increasing' | 'decreasing' | 'stable' => {
    if (energies.length < 2) return 'stable';

    const recentAverage = energies.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const previousAverage = energies.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

    const change = (recentAverage - previousAverage) / previousAverage;

    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
};

export interface FrequencyPeak {
  [key: string]: number | number[] | string; // Add index signature
  frequency: number;
  amplitude: number;
  harmonics: number[];
  snr: number;
}

export interface HarmonicMatch {
  order: number;
  expectedFrequency: number;
  matchedFrequency: number;
  amplitude: number;
  detuneHz: number;
  detuneCents: number;
}

export interface SidebandMatch {
  side: 'lower' | 'upper';
  index: number;
  expectedFrequency: number;
  matchedFrequency: number;
  amplitude: number;
  offsetHz: number;
  detuneHz: number;
}

const toCents = (actual: number, expected: number): number => {
  if (actual <= 0 || expected <= 0) return 0;
  return 1200 * Math.log2(actual / expected);
};

const findClosestPeak = (
  peaks: FrequencyPeak[],
  expectedFrequency: number,
  toleranceHz: number
): FrequencyPeak | undefined => {
  const candidates = peaks.filter(
    peak => Math.abs(peak.frequency - expectedFrequency) <= toleranceHz
  );

  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, current) => {
    if (!best) return current;
    return current.amplitude > best.amplitude ? current : best;
  }, undefined as FrequencyPeak | undefined);
};

export const findHarmonicSeries = (
  peaks: FrequencyPeak[],
  fundamentalHz: number,
  maxOrder: number = 12,
  toleranceCents: number = 35
): HarmonicMatch[] => {
  if (fundamentalHz <= 0 || peaks.length === 0) return [];

  const maxToleranceRatio = Math.pow(2, toleranceCents / 1200) - 1;
  const matches: HarmonicMatch[] = [];

  for (let order = 1; order <= Math.max(1, maxOrder); order++) {
    const expectedFrequency = fundamentalHz * order;
    const toleranceHz = Math.max(1, expectedFrequency * maxToleranceRatio);
    const matched = findClosestPeak(peaks, expectedFrequency, toleranceHz);
    if (!matched) continue;

    matches.push({
      order,
      expectedFrequency,
      matchedFrequency: matched.frequency,
      amplitude: matched.amplitude,
      detuneHz: matched.frequency - expectedFrequency,
      detuneCents: toCents(matched.frequency, expectedFrequency),
    });
  }

  return matches;
};

export const findSidebands = (
  peaks: FrequencyPeak[],
  carrierHz: number,
  spacingHz: number,
  sidebandCount: number = 5,
  toleranceHz: number = 5
): SidebandMatch[] => {
  if (carrierHz <= 0 || spacingHz <= 0 || peaks.length === 0) return [];

  const matches: SidebandMatch[] = [];
  for (let index = 1; index <= Math.max(1, sidebandCount); index++) {
    const delta = spacingHz * index;
    const lowerExpected = carrierHz - delta;
    const upperExpected = carrierHz + delta;

    if (lowerExpected > 0) {
      const lower = findClosestPeak(peaks, lowerExpected, Math.max(0.5, toleranceHz));
      if (lower) {
        matches.push({
          side: 'lower',
          index,
          expectedFrequency: lowerExpected,
          matchedFrequency: lower.frequency,
          amplitude: lower.amplitude,
          offsetHz: lower.frequency - carrierHz,
          detuneHz: lower.frequency - lowerExpected,
        });
      }
    }

    const upper = findClosestPeak(peaks, upperExpected, Math.max(0.5, toleranceHz));
    if (upper) {
      matches.push({
        side: 'upper',
        index,
        expectedFrequency: upperExpected,
        matchedFrequency: upper.frequency,
        amplitude: upper.amplitude,
        offsetHz: upper.frequency - carrierHz,
        detuneHz: upper.frequency - upperExpected,
      });
    }
  }

  return matches.sort((a, b) => Math.abs(a.offsetHz) - Math.abs(b.offsetHz));
};

export const calculateNoiseFloor = (data: TimeSeriesPoint[]): number => {
  if (data.length === 0) return 0;

  // Use lowest 10% of values for noise floor calculation
  const sortedAmplitudes = [...data].sort((a, b) => a.y - b.y);
  const noiseWindowSize = Math.max(1, Math.floor(data.length * 0.1));
  const noiseWindow = sortedAmplitudes.slice(0, noiseWindowSize);

  // Use RMS (Root Mean Square) for better handling of small values
  const sum = noiseWindow.reduce((acc, point) => {
    const value = Math.max(Math.abs(point.y), 1e-15); // Prevent zero values
    return acc + (value * value); // Square the values
  }, 0);

  const rms = Math.sqrt(sum / noiseWindow.length);
  return Math.max(rms, 1e-12); // Ensure minimum noise floor
};

export const findPeaks = (
  fftData: TimeSeriesPoint[],
  minSnr: number = 3,
  minFrequency: number = 2,
  maxFrequency: number = 20000
): FrequencyPeak[] => {
  const noiseFloor = calculateNoiseFloor(fftData);
  //const maxAmplitude = Math.max(...fftData.map(p => p.y));

  // Adjust threshold for better harmonic detection
//   const getThreshold = (freq: number) => {
//     // Lower threshold for potential harmonics
//     const freqFactor = Math.min(1, freq / 1000);
//     return noiseFloor * (2 + freqFactor); // Linear threshold with frequency
//   };

  return fftData
    .filter((point, i) => {
      if (point.x < minFrequency || point.x > maxFrequency) return false;

      // Calculate SNR for this point
      const snr = point.y / noiseFloor;
      if (snr < minSnr) return false;

      // More lenient local maximum check
      const window = 1; // Reduced window size
      for (let j = Math.max(0, i - window); j < Math.min(fftData.length, i + window + 1); j++) {
        if (j !== i && fftData[j].y > point.y) return false;
      }

      return true;
    })
    .map(peak => ({
      frequency: peak.x,
      amplitude: peak.y,
      harmonics: [],
      snr: peak.y / noiseFloor
    }));
};

// Update findHarmonics to work with smaller amplitudes
export const findHarmonics = (
  fundamental: number,
  peaks: FrequencyPeak[],
  tolerance: number = 0.05
): number[] => {
  const maxHarmonic = 5;
  const harmonics: number[] = [];
  const fundamentalLog = Math.log10(peaks[0].amplitude + 1e-15);

  for (let n = 2; n <= maxHarmonic; n++) {
    const expectedHarmonic = fundamental * n;
    const toleranceHz = expectedHarmonic * tolerance;

    // Allow for weaker harmonics using log scaling
    const minHarmonicLevel = Math.pow(10, fundamentalLog - Math.log10(n * 2));

    const harmonic = peaks.find(peak =>
      Math.abs(peak.frequency - expectedHarmonic) <= toleranceHz &&
      peak.amplitude >= minHarmonicLevel
    );

    if (harmonic) {
      harmonics.push(harmonic.frequency);
    }
  }

  return harmonics;
};

export interface FrequencyAnalysisOptions {
    minSnr?: number;
    minFrequency?: number;
    maxFrequency?: number;
    maxPeaks?: number;
  fundamentalHz?: number;
  harmonicToleranceCents?: number;
  maxHarmonicOrder?: number;
  sidebandCarrierHz?: number;
  sidebandSpacingHz?: number;
  sidebandCount?: number;
  sidebandToleranceHz?: number;
}

export interface FrequencyAnalysisResult {
    peaks: FrequencyPeak[];
  selectedFundamentalHz: number | null;
  harmonicSeries: HarmonicMatch[];
  sidebands: SidebandMatch[];
    stats: {
        maxAmplitude: number;
        minAmplitude: number;
        medianAmplitude: number;
        noiseFloor: number;
    };
}

export interface AutoDetectAnalysisResult {
  fundamentalHz: number | null;
  carrierHz: number | null;
  sidebandSpacingHz: number | null;
  harmonicMatchCount: number;
  sidebandPairCount: number;
}

export const autoDetectAnalysisTargets = (
  fftData: TimeSeriesPoint[],
  options: FrequencyAnalysisOptions = {}
): AutoDetectAnalysisResult => {
  if (fftData.length === 0) {
    return {
      fundamentalHz: null,
      carrierHz: null,
      sidebandSpacingHz: null,
      harmonicMatchCount: 0,
      sidebandPairCount: 0,
    };
  }

  const minSnr = options.minSnr ?? 3;
  const minFrequency = options.minFrequency ?? 20;
  const maxFrequency = options.maxFrequency ?? 20000;
  const candidatePeaks = findPeaks(fftData, minSnr, minFrequency, maxFrequency)
    .sort((a, b) => b.amplitude - a.amplitude)
    .slice(0, Math.max(12, options.maxPeaks ?? 12));

  if (candidatePeaks.length === 0) {
    return {
      fundamentalHz: null,
      carrierHz: null,
      sidebandSpacingHz: null,
      harmonicMatchCount: 0,
      sidebandPairCount: 0,
    };
  }

  const carrier = candidatePeaks[0];

  let bestFundamental: number | null = null;
  let bestFundamentalScore = -Infinity;
  let bestHarmonicMatchCount = 0;

  const fundamentalCandidates = [...candidatePeaks]
    .sort((a, b) => a.frequency - b.frequency)
    .slice(0, Math.min(8, candidatePeaks.length));

  for (const candidate of fundamentalCandidates) {
    const f0 = candidate.frequency;
    let score = 0;
    let matches = 0;

    for (const peak of candidatePeaks) {
      if (peak.frequency < f0 * 0.8) continue;
      const harmonicOrder = Math.max(1, Math.round(peak.frequency / f0));
      const expected = f0 * harmonicOrder;
      const detuneRatio = Math.abs(peak.frequency - expected) / Math.max(expected, 1e-9);
      if (detuneRatio <= 0.03) {
        matches += 1;
        score += peak.amplitude / (1 + 0.2 * (harmonicOrder - 1));
      }
    }

    if (matches >= 2 && score > bestFundamentalScore) {
      bestFundamental = f0;
      bestFundamentalScore = score;
      bestHarmonicMatchCount = matches;
    }
  }

  if (bestFundamental === null) {
    bestFundamental = fundamentalCandidates[0].frequency;
    bestHarmonicMatchCount = 1;
  }

  const offsetToleranceHz = Math.max(1, carrier.frequency * 0.01);
  const spacingCandidates = candidatePeaks
    .map(peak => Math.abs(peak.frequency - carrier.frequency))
    .filter(delta => delta > offsetToleranceHz)
    .sort((a, b) => a - b);

  type SidebandSpacingCandidate = { spacingHz: number; score: number; pairs: number };
  const groupedCandidates: SidebandSpacingCandidate[] = [];

  for (const delta of spacingCandidates) {
    const group = groupedCandidates.find(c => Math.abs(c.spacingHz - delta) <= offsetToleranceHz);
    if (!group) {
      groupedCandidates.push({ spacingHz: delta, score: 0, pairs: 0 });
    }
  }

  const findMatch = (expected: number): FrequencyPeak | undefined =>
    candidatePeaks.find(peak => Math.abs(peak.frequency - expected) <= offsetToleranceHz);

  for (const candidate of groupedCandidates) {
    for (let n = 1; n <= 6; n++) {
      const lowerExpected = carrier.frequency - candidate.spacingHz * n;
      const upperExpected = carrier.frequency + candidate.spacingHz * n;
      if (lowerExpected <= 0 || upperExpected > maxFrequency) continue;

      const lower = findMatch(lowerExpected);
      const upper = findMatch(upperExpected);
      if (lower && upper) {
        candidate.pairs += 1;
        candidate.score += (lower.amplitude + upper.amplitude) / n;
      }
    }
  }

  const bestSpacing = groupedCandidates
    .filter(c => c.pairs > 0)
    .sort((a, b) => b.score - a.score)[0];

  return {
    fundamentalHz: bestFundamental,
    carrierHz: carrier.frequency,
    sidebandSpacingHz: bestSpacing?.spacingHz ?? null,
    harmonicMatchCount: bestHarmonicMatchCount,
    sidebandPairCount: bestSpacing?.pairs ?? 0,
  };
};

export const analyzeFrequencies = (
    fftData: TimeSeriesPoint[],
    options: FrequencyAnalysisOptions = {}
): FrequencyAnalysisResult => {
    if (fftData.length === 0) {
      return {
        peaks: [],
        selectedFundamentalHz: null,
        harmonicSeries: [],
        sidebands: [],
        stats: {
          maxAmplitude: 0,
          minAmplitude: 0,
          medianAmplitude: 0,
          noiseFloor: 0,
        }
      };
    }

    const {
        minSnr = 3,
        minFrequency = 20,
        maxFrequency = 20000,
        maxPeaks = 50,
        fundamentalHz,
        harmonicToleranceCents = 35,
        maxHarmonicOrder = 12,
        sidebandCarrierHz,
        sidebandSpacingHz = 0,
        sidebandCount = 5,
        sidebandToleranceHz = 5,
    } = options;

    const amplitudes = fftData.map(p => p.y);
    //const maxAmplitude = Math.max(...amplitudes);
    //const minAmplitude = Math.min(...amplitudes);
    const maxAmplitude = amplitudes.reduce((max, val) => Math.max(max, val), -Infinity);
    const minAmplitude = amplitudes.reduce((min, val) => Math.min(min, val), Infinity);

    const sortedAmplitudes = [...amplitudes].sort((a, b) => a - b);
    const medianAmplitude = sortedAmplitudes[Math.floor(sortedAmplitudes.length / 2)];
    const noiseFloor = calculateNoiseFloor(fftData);

    // First, get all peaks
    const allPeaks = findPeaks(fftData, minSnr, minFrequency, maxFrequency);
    let peaks = [...allPeaks];

    // Sort by amplitude
    peaks.sort((a, b) => b.amplitude - a.amplitude);

    // Get the strongest peak's amplitude
    const strongestPeakAmplitude = peaks.length > 0 ? peaks[0].amplitude : 0;

    // Filter peaks that are too weak compared to the strongest peak
    // Keep only peaks that are at least 1% (-40dB) of the strongest peak
    peaks = peaks.filter(peak =>
        peak.amplitude >= strongestPeakAmplitude * 0.01
    ).slice(0, maxPeaks);

    // Find harmonics for remaining peaks
    peaks.forEach(peak => {
        peak.harmonics = findHarmonics(peak.frequency, peaks);
    });

    const selectedFundamentalHz =
      typeof fundamentalHz === 'number' && fundamentalHz > 0
        ? fundamentalHz
        : peaks.length > 0
          ? peaks[0].frequency
          : null;

    const harmonicSeries = selectedFundamentalHz
      ? findHarmonicSeries(allPeaks, selectedFundamentalHz, maxHarmonicOrder, harmonicToleranceCents)
      : [];

    const sidebands =
      typeof sidebandCarrierHz === 'number' && sidebandCarrierHz > 0 && sidebandSpacingHz > 0
        ? findSidebands(allPeaks, sidebandCarrierHz, sidebandSpacingHz, sidebandCount, sidebandToleranceHz)
        : [];

    return {
        peaks,
        selectedFundamentalHz,
        harmonicSeries,
        sidebands,
        stats: {
            maxAmplitude,
            minAmplitude,
            medianAmplitude,
            noiseFloor
        }
    };
};


export type VibrationData = {
  acceleration: number[];  // Acceleration time series data
  sampleRate: number;      // In Hz
};

export type VelocityAnalysis = {
  velocity: number[];      // Integrated velocity True peak
  //peak?: number[];           // Optional: Peak velocity
  rms?: number[];            // Optional: RMS velocity
};


function integrateTrapezoidal(data: number[], dt: number): number[] {
  if (data.length === 0) return [0];

  const velocity: number[] = [0];
  for (let i = 1; i < data.length; i++) {
    const v = velocity[i - 1] + ((data[i - 1] + data[i]) / 2) * dt;
    velocity.push(v);
  }
  return velocity;
}



export function calculateRMS(data: number[]): number {
  if (data.length === 0) return NaN;
  const squareSum = data.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(squareSum / data.length);
}

export function calculateRunningPeak(data: number[]): number[] {
  const peakValues: number[] = [];
  let maxVal = 0;

  for (let i = 0; i < data.length; i++) {
    maxVal = Math.max(maxVal, Math.abs(data[i]));
    peakValues.push(maxVal);
  }

  return peakValues;
}

function calculateRunningRMS(data: number[]): number[] {
  const rmsValues: number[] = [];
  let sumOfSquares = 0;

  for (let i = 0; i < data.length; i++) {
    sumOfSquares += data[i] * data[i];
    const rms = Math.sqrt(sumOfSquares / (i + 1));
    rmsValues.push(rms);
  }

  return rmsValues;
}


export function convertAccelerationToVelocity(
  input: VibrationData,
  options: { computeStats?: boolean } = {}
): VelocityAnalysis {
  const { acceleration, sampleRate } = input;
  const dt = 1 / sampleRate;

  const velocity = integrateTrapezoidal(acceleration, dt);

  if (!options.computeStats) {
    return { velocity };
  }

  return {
    velocity,
    rms: calculateRunningRMS(velocity),
  };
}

export function vibrationToVelocityRMS( signal: { x: number; y: number }[]
): { x: number; y: number }[] {
  const velocity = vibrationToVelocityXY(signal);
  return computeRMSXY(velocity);
}

export function vibrationToVelocityXY(
  signal: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (signal.length < 2) return [];

  const velocity: { x: number; y: number }[] = [{ x: signal[0].x, y: 0 }]; // start at time x with 0 velocity

  for (let i = 1; i < signal.length; i++) {
    const dt = signal[i].x - signal[i - 1].x;
    const avgAccel = 0.5 * (signal[i].y + signal[i - 1].y);
    const area = avgAccel * dt;
    const newVelocity = velocity[i - 1].y + area;
    velocity.push({ x: signal[i].x, y: newVelocity });
  }

  return velocity;
}

export function computeRMSXY(signal: { x: number; y: number }[]): { x: number; y: number }[] {
  if (signal.length === 0) return [];

  const rmsValues: { x: number; y: number }[] = [];

  for (let i = 0; i < signal.length; i++) {
    const sumOfSquaresY = signal[i].y * signal[i].y;
    const rmsY = Math.sqrt(sumOfSquaresY / (i + 1));
    rmsValues.push({ x: signal[i].x, y: rmsY });
  }

  return rmsValues;
}

export function pickPeaks(
  spectrum: Float32Array,
  sampleRate: number,
  threshold: number,
  maxPeaks = 5
) {
  const peaks: { freq: number; amp: number }[] = [];

  for (let i = 1; i < spectrum.length - 1; i++) {
    if (
      spectrum[i] > threshold &&
      spectrum[i] > spectrum[i - 1] &&
      spectrum[i] > spectrum[i + 1]
    ) {
      const freq = (i * sampleRate) / (2 * spectrum.length);
      peaks.push({ freq, amp: spectrum[i] });
    }
  }

  return peaks
    .sort((a, b) => b.amp - a.amp)
    .slice(0, maxPeaks);
}
