import React, { useMemo } from 'react';
import { TimeSeriesPoint, findPeaks, findHarmonics, FrequencyPeak, analyzeFrequencies } from '../utils/signal-processing';
import DataTable from './DataTable';

interface FrequencyAnalyzerProps {
  fftData: TimeSeriesPoint[];
  minSnr?: number;
  minFrequency?: number;
  maxFrequency?: number;
  maxPeaks?: number;
}

const FrequencyAnalyzer: React.FC<FrequencyAnalyzerProps> = ({
  fftData,
  minSnr = 3,
  minFrequency = 1, // Changed to 0 to see all frequencies
  maxFrequency = 20000,
  maxPeaks = 50
}) => {
  const formatAmplitude = (value: number) => {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    if (value < 1e-9) {
      return value.toExponential(2);
    }
    return value.toPrecision(4);
  };

  const formatDB = (value: number) => {
    return (20 * Math.log10(value + 1e-15)).toFixed(1) + ' dB';
  };

  const analysisResult = analyzeFrequencies(
    fftData,
    {
      minSnr,
      minFrequency,
      maxFrequency,
      maxPeaks
    }
  );

  const columns = [
    {
      header: 'Frequency (Hz)',
      key: 'frequency',
      render: (peak: FrequencyPeak) => peak.frequency.toFixed(1)
    },
    {
      header: 'Amplitude',
      key: 'amplitude',
      render: (peak: FrequencyPeak) => formatAmplitude(peak.amplitude)
    },
    {
      header: 'Level (dB)',
      key: 'level',
      render: (peak: FrequencyPeak) => formatDB(peak.amplitude)
    },
    {
      header: 'SNR (dB)',
      key: 'snr',
      render: (peak: FrequencyPeak) => formatDB(peak.snr)
    },
    {
      header: 'Harmonics (Hz)',
      key: 'harmonics',
      render: (peak: FrequencyPeak) => peak.harmonics.map(h => h.toFixed(1)).join(', ')
    }
  ];

  return (
    <div className="frequency-analyzer">
      <div className="analysis-info">
        <small>
          Max Amplitude: {formatAmplitude(Math.max(...fftData.map(p => p.y)))}
          <br />
          Median Amplitude: {formatAmplitude([...fftData].map(p => p.y).sort((a, b) => a - b)[Math.floor(fftData.length / 2)])}
          <br />
          Min Amplitude: {formatAmplitude(Math.min(...fftData.map(p => p.y)))}
          <br />
          Noise Floor: {formatAmplitude(analysisResult.stats.noiseFloor)}
        </small>
      </div>

      <DataTable
        data={analysisResult.peaks}
        columns={columns}
        title="Frequency Analysis"
        className="frequency-table"
      />
    </div>
  );
};

export default React.memo(FrequencyAnalyzer);
