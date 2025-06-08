import { analyzeFrequencyBands, commonFrequencyBands } from '../utils/frequency-analyzer';

const example = async () => {
  // Example: Analyze 1 second of audio in 100ms windows
  const sampleRate = 44100;
  const windowSize = 4410; // 100ms at 44.1kHz
  const numWindows = 10; // 1 second total

  // Simulate or collect your time series data
  const timeSeriesWindows = Array.from({ length: numWindows }, (_, windowIndex) => 
    Array.from({ length: windowSize }, (_, i) => ({
      x: (i + windowIndex * windowSize) / sampleRate,
      // Example: Generate a signal with multiple frequencies
      y: Math.sin(2 * Math.PI * 100 * i / sampleRate) + // 100 Hz
         Math.sin(2 * Math.PI * 1000 * i / sampleRate) + // 1000 Hz
         Math.sin(2 * Math.PI * 5000 * i / sampleRate)   // 5000 Hz
    }))
  );

  // Analyze the frequency bands
  const analysis = analyzeFrequencyBands(timeSeriesWindows, sampleRate, commonFrequencyBands);

  // Process results
  analysis.forEach(band => {
    console.log(`${band.name}:`);
    console.log(`  Average energy: ${band.energies.reduce((a, b) => a + b, 0) / band.energies.length}`);
    console.log(`  Trend: ${band.trend}`);
  });

  return analysis;
};

export default example;
