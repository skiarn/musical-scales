import { 
    applyMovingAverage, 
    applyHanningWindow, 
    trackFrequencyBand, 
    detectTrend,
    findPeaks,
    findHarmonics,
    calculateNoiseFloor
} from '../signal-processing';

describe('Signal Processing', () => {
    test('Moving Average smooths data', () => {
        const testData = [
            { x: 0, y: 1 },
            { x: 1, y: 2 },
            { x: 2, y: 10 },
            { x: 3, y: 2 },
            { x: 4, y: 1 }
        ];
        const smoothed = applyMovingAverage(testData, 1);
        expect(smoothed[2].y).toBeLessThan(10); // Should be smoothed out
    });

    test('Hanning Window tapers edges', () => {
        const testData = Array(10).fill(0).map((_, i) => ({ x: i, y: 1 }));
        const windowed = applyHanningWindow(testData);
        expect(windowed[0].y).toBeLessThan(0.1); // Start should be near zero
        expect(windowed[9].y).toBeLessThan(0.1); // End should be near zero
    });

    test('Frequency Band Tracking', () => {
        const fftFrames = [
            [
                { frequency: 100, amplitude: 1 },
                { frequency: 200, amplitude: 2 },
                { frequency: 300, amplitude: 1 }
            ],
            [
                { frequency: 100, amplitude: 2 },
                { frequency: 200, amplitude: 3 },
                { frequency: 300, amplitude: 2 }
            ]
        ];
        const energies = trackFrequencyBand(fftFrames, 150, 250);
        expect(energies).toHaveLength(2);
        expect(energies[0]).toBe(2); // Only the 200Hz component
    });

    test('Trend Detection', () => {
        const increasingEnergies = [1, 2, 3, 4, 5, 6];
        const stableEnergies = [2, 2, 2, 2, 2, 2];
        
        expect(detectTrend(increasingEnergies, 0.1)).toBe('increasing');
        expect(detectTrend(stableEnergies, 0.1)).toBe('stable');
    });
});

describe('signal-processing', () => {
    describe('findPeaks', () => {
        it('should identify peaks above noise floor', () => {
            const testData = [
                { x: 100, y: 0.1 },   // noise
                { x: 200, y: 0.1 },   // noise
                { x: 440, y: 1.0 },   // strong peak
                { x: 441, y: 0.2 },   // noise
                { x: 880, y: 0.6 },   // harmonic peak
                { x: 881, y: 0.2 },   // noise
            ];

            const peaks = findPeaks(testData, 3);
            expect(peaks.length).toBe(2);
            expect(peaks[0].frequency).toBe(440);
            expect(peaks[1].frequency).toBe(880);
        });
    });

    describe('findHarmonics', () => {
        it('should identify harmonic frequencies', () => {
            const peaks = [
                { frequency: 440, amplitude: 1.0, harmonics: [], snr: 10 },
                { frequency: 880, amplitude: 0.5, harmonics: [], snr: 5 },
                { frequency: 1320, amplitude: 0.3, harmonics: [], snr: 3 },
            ];

            const harmonics = findHarmonics(440, peaks);
            expect(harmonics).toContain(880);  // 2nd harmonic
            expect(harmonics).toContain(1320); // 3rd harmonic
        });
    });

    describe('calculateNoiseFloor', () => {
        it('should calculate noise floor from lower quartile', () => {
            const testData = [
                { x: 100, y: 0.002 },  // Increased minimum values
                { x: 200, y: 0.003 },
                { x: 300, y: 0.1 },
                { x: 400, y: 0.015 },
                { x: 500, y: 0.008 },
                { x: 600, y: 0.004 },
                { x: 700, y: 0.005 },
                { x: 800, y: 0.007 }
            ];

            const noiseFloor = calculateNoiseFloor(testData);
            expect(noiseFloor).toBeGreaterThan(0.001);
            expect(noiseFloor).toBeLessThan(0.01);
        });
    });
});
