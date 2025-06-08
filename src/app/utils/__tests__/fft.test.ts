import { computeFFT, transformFFTData, filterFFTData } from '../fft';

describe('FFT Utils', () => {
  const mockTimeData = Array.from({ length: 8 }, (_, i) => ({
    x: i,
    y: Math.sin(2 * Math.PI * i / 8) // Simple sine wave
  }));

  test('computeFFT should return correct number of frequency points', () => {
    const result = computeFFT(mockTimeData, 44100);
    expect(result.length).toBe(mockTimeData.length / 2);
    expect(result[0]).toHaveProperty('frequency');
    expect(result[0]).toHaveProperty('amplitude');
  });

  test('transformFFTData should convert frequency-amplitude to x-y format', () => {
    const fftData = [
      { frequency: 100, amplitude: 0.5 },
      { frequency: 200, amplitude: 0.3 }
    ];
    const result = transformFFTData(fftData);
    expect(result[0]).toEqual({ x: 100, y: 0.5 });
    expect(result[1]).toEqual({ x: 200, y: 0.3 });
  });

  test('filterFFTData should filter frequencies within range', () => {
    // Create a signal with known frequency components
    const sampleRate = 1000; // 1kHz sample rate
    const duration = 1; // 1 second
    const numSamples = sampleRate * duration;
    
    // Generate a test signal with 200Hz component
    const mockData = Array.from({ length: numSamples }, (_, i) => ({
      x: i / sampleRate,
      // Add a strong 200Hz component
      y: Math.sin(2 * Math.PI * 200 * i / sampleRate) * 2
    }));

    const fftData = computeFFT(mockData, sampleRate);

    // Log the FFT data around 200Hz for debugging
    console.log('FFT data near 200Hz:', 
      fftData.filter(d => Math.abs(d.frequency - 200) < 10)
    );

    const result = filterFFTData(fftData, sampleRate, 150, 250);

    // More detailed assertions
    const has200HzComponent = result.amplitudes.some(a => 
      Math.abs(a.frequency - 200) < 5 && a.amplitude > 0.1
    );
    
    expect(has200HzComponent).toBeTruthy();
    expect(result.frequencies).toContainEqual(expect.any(Number));
    expect(Math.min(...result.frequencies)).toBeGreaterThanOrEqual(150);
    expect(Math.max(...result.frequencies)).toBeLessThanOrEqual(250);
  });
});
