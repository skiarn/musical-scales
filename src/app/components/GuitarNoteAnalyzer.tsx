import React, { useMemo } from 'react';
import { guitarNotes, GuitarNote } from '../utils/guitar-frequencies';

interface GuitarNoteAnalyzerProps {
  fftData: { x: number; y: number }[];
  signalToNoiseRatio?: number;
  frequencyTolerance?: number;
  maxNotesToShow?: number;
}

interface NoteWithConfidence extends GuitarNote {
  confidence: number;
  harmonics: number[];  // Store harmonic frequencies found
  isHarmonic: boolean;  // Flag if this note is likely a harmonic of another
}

const GuitarNoteAnalyzer: React.FC<GuitarNoteAnalyzerProps> = ({
  fftData,
  signalToNoiseRatio: defaultSNR = 3,
  frequencyTolerance: defaultTolerance = 5,
  maxNotesToShow = 6
}) => {
  const calculateNoiseFloor = (data: { x: number; y: number }[]): number => {
    if (data.length === 0) return 0;
    
    // Enhanced noise floor calculation
    const sortedAmplitudes = [...data].sort((a, b) => a.y - b.y);
    const lowerQuintileIndex = Math.floor(data.length * 0.2);
    const lowerQuintile = sortedAmplitudes.slice(0, lowerQuintileIndex);
    
    const noiseFloor = lowerQuintile.reduce((sum, point) => sum + point.y, 0) / lowerQuintile.length;
    // Ensure minimum noise floor
    return Math.max(noiseFloor, 0.001);
  };

  const isHarmonic = (freq1: number, freq2: number, tolerance: number): boolean => {
    // Check if freq1 is a harmonic of freq2
    const ratio = freq1 / freq2;
    const nearestHarmonic = Math.round(ratio);
    return Math.abs(ratio - nearestHarmonic) < (tolerance / freq2) && nearestHarmonic > 1;
  };

  const findHarmonics = (frequency: number, peaks: { x: number, y: number }[], noiseFloor: number): number[] => {
    const maxHarmonic = 5; // Only check up to 5th harmonic
    const harmonics: number[] = [];
    
    for (let n = 2; n <= maxHarmonic; n++) {
      const expectedHarmonic = frequency * n;
      const toleranceAtHarmonic = (parameters.tolerance * n) / 2; // Tolerance increases with harmonic number
      
      const matchingPeak = peaks.find(peak => {
        const diffFromHarmonic = Math.abs(peak.x - expectedHarmonic);
        const isWithinTolerance = diffFromHarmonic <= toleranceAtHarmonic;
        const hasReasonableAmplitude = peak.y >= noiseFloor * (parameters.snr / n); // Lower SNR requirement for higher harmonics
        
        return isWithinTolerance && hasReasonableAmplitude;
      });
      
      if (matchingPeak) {
        harmonics.push(matchingPeak.x);
      }
    }
    
    return harmonics;
  };

  // Calculate optimal parameters based on the data
  const parameters = useMemo(() => {
    if (fftData.length === 0) return { snr: defaultSNR, tolerance: defaultTolerance };

    // Calculate dynamic SNR based on peak to noise ratio
    const sortedAmplitudes = [...fftData].sort((a, b) => b.y - a.y);
    const maxAmplitude = sortedAmplitudes[0].y;
    const noiseLevel = calculateNoiseFloor(fftData);
    const peakToNoise = maxAmplitude / noiseLevel;
    const dynamicSNR = Math.max(2, Math.min(peakToNoise * 0.3, 5));

    // Calculate frequency tolerance based on frequency resolution
    const freqResolution = fftData[1]?.x - fftData[0]?.x || 1;
    const dynamicTolerance = Math.max(freqResolution * 2, Math.min(10, freqResolution * 4));

    return {
      snr: dynamicSNR,
      tolerance: dynamicTolerance
    };
  }, [fftData, defaultSNR, defaultTolerance]);

  const playedNotes = useMemo(() => {
    const candidateNotes: NoteWithConfidence[] = [];
    const allNotes = Object.values(guitarNotes).flat();
    const noiseFloor = calculateNoiseFloor(fftData);
    const dynamicThreshold = noiseFloor * parameters.snr;

    // Find peaks in the FFT data
    const peaks = fftData.filter((point, i) => {
      if (point.y <= dynamicThreshold) return false;
      const prevY = i > 0 ? fftData[i - 1].y : 0;
      const nextY = i < fftData.length - 1 ? fftData[i + 1].y : 0;
      return point.y > prevY && point.y > nextY;
    });

    // First pass: identify all potential notes and their harmonics
    peaks.forEach(peak => {
      allNotes.forEach(note => {
        const freqDiff = Math.abs(note.frequency - peak.x);
        if (freqDiff <= parameters.tolerance) {
          const harmonics = findHarmonics(note.frequency, peaks, noiseFloor);
          const harmonicStrength = harmonics.reduce((sum, harmFreq) => {
            const harmPeak = peaks.find(p => Math.abs(p.x - harmFreq) <= parameters.tolerance);
            return sum + (harmPeak ? harmPeak.y / peak.y : 0);
          }, 0);

          const confidence = (peak.y / noiseFloor) * 
                           (1 - freqDiff / parameters.tolerance) * 
                           (1 + harmonicStrength * 0.5); // Boost confidence based on harmonics

          candidateNotes.push({
            ...note,
            confidence,
            harmonics,
            isHarmonic: false
          });
        }
      });
    });

    // Second pass: mark harmonics and merge confidences
    candidateNotes.sort((a, b) => b.confidence - a.confidence);
    
    for (let i = 0; i < candidateNotes.length; i++) {
      for (let j = i + 1; j < candidateNotes.length; j++) {
        if (isHarmonic(candidateNotes[j].frequency, candidateNotes[i].frequency, parameters.tolerance)) {
          candidateNotes[i].confidence += candidateNotes[j].confidence * 0.3;
          candidateNotes[j].isHarmonic = true;
        }
      }
    }

    return candidateNotes
      .filter(note => !note.isHarmonic)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxNotesToShow);
  }, [fftData, parameters, maxNotesToShow]);

  const noiseFloor = useMemo(() => calculateNoiseFloor(fftData), [fftData]);

  return (
    <div className="guitar-note-analyzer">
      <h2>Most Likely Notes</h2>
      <div className="noise-info">
        <small>
          Noise Floor: {noiseFloor.toFixed(6)} | 
          SNR: {parameters.snr.toFixed(1)} | 
          Tolerance: {parameters.tolerance.toFixed(1)}Hz
        </small>
      </div>
      {playedNotes.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>String</th>
              <th>Fret</th>
              <th>Note</th>
              <th>Frequency (Hz)</th>
              <th>Confidence</th>
              <th>Harmonics Found</th>
            </tr>
          </thead>
          <tbody>
            {playedNotes.map((note, index) => (
              <tr 
                key={`${note.string}-${note.fret}-${index}`}
                style={{ 
                  backgroundColor: `rgba(76, 175, 80, ${note.confidence / (playedNotes[0].confidence || 1)})`
                }}
              >
                <td>{note.string}</td>
                <td>{note.fret}</td>
                <td>{note.note}</td>
                <td>{note.frequency}</td>
                <td>{note.confidence.toFixed(1)}x</td>
                <td>{note.harmonics.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No guitar notes detected</p>
      )}
    </div>
  );
};

export default React.memo(GuitarNoteAnalyzer);
