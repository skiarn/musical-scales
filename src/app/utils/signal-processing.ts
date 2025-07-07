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
}

export interface FrequencyAnalysisResult {
    peaks: FrequencyPeak[];
    stats: {
        maxAmplitude: number;
        minAmplitude: number;
        medianAmplitude: number;
        noiseFloor: number;
    };
}

export const analyzeFrequencies = (
    fftData: TimeSeriesPoint[],
    options: FrequencyAnalysisOptions = {}
): FrequencyAnalysisResult => {
    const {
        minSnr = 3,
        minFrequency = 20,
        maxFrequency = 20000,
        maxPeaks = 50
    } = options;

    const amplitudes = fftData.map(p => p.y);
    const maxAmplitude = Math.max(...amplitudes);
    const minAmplitude = Math.min(...amplitudes);
    const sortedAmplitudes = [...amplitudes].sort((a, b) => a - b);
    const medianAmplitude = sortedAmplitudes[Math.floor(sortedAmplitudes.length / 2)];
    const noiseFloor = calculateNoiseFloor(fftData);

    // First, get all peaks
    let peaks = findPeaks(fftData, minSnr, minFrequency, maxFrequency);
    
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

    return {
        peaks,
        stats: {
            maxAmplitude,
            minAmplitude,
            medianAmplitude,
            noiseFloor
        }
    };
};
