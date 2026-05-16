import React from 'react';
import './FrequencyAnalyzer.css';
import {
  TimeSeriesPoint,
  FrequencyPeak,
  analyzeFrequencies,
  autoDetectAnalysisTargets,
} from '../../utils/signal-processing';
import DataTable, { DataRecord, Column } from '../DataTable';

// Ensure FrequencyPeak implements DataRecord
interface FrequencyPeakRecord extends FrequencyPeak, DataRecord { }

interface FrequencyAnalyzerProps {
  fftData: TimeSeriesPoint[];
  minSnr?: number;
  minFrequency?: number;
  maxFrequency?: number;
  maxPeaks?: number;
}

type StabilityFrame = {
  harmonicCoverage: number;
  sidebandBalance: number;
  detuneQuality: number;
  fundamentalHz: number | null;
  spacingHz: number;
};

const FrequencyAnalyzer: React.FC<FrequencyAnalyzerProps> = ({
  fftData,
  minSnr = 3,
  minFrequency = 1,
  maxFrequency = 20000,
  maxPeaks = 50
}) => {
  const [fundamentalHz, setFundamentalHz] = React.useState(110);
  const [harmonicToleranceCents, setHarmonicToleranceCents] = React.useState(35);
  const [maxHarmonicOrder, setMaxHarmonicOrder] = React.useState(12);
  const [sidebandCarrierHz, setSidebandCarrierHz] = React.useState(440);
  const [sidebandSpacingHz, setSidebandSpacingHz] = React.useState(110);
  const [sidebandToleranceHz, setSidebandToleranceHz] = React.useState(5);
  const [sidebandCount, setSidebandCount] = React.useState(6);
  const [autoDetectInfo, setAutoDetectInfo] = React.useState('');
  const [historyFrameCount, setHistoryFrameCount] = React.useState(40);
  const [stabilityHistory, setStabilityHistory] = React.useState<StabilityFrame[]>([]);

  const handleAutoDetect = React.useCallback(() => {
    const result = autoDetectAnalysisTargets(fftData, {
      minSnr,
      minFrequency,
      maxFrequency,
      maxPeaks,
    });

    if (result.fundamentalHz) setFundamentalHz(result.fundamentalHz);
    if (result.carrierHz) setSidebandCarrierHz(result.carrierHz);
    if (result.sidebandSpacingHz) {
      setSidebandSpacingHz(result.sidebandSpacingHz);
      setSidebandToleranceHz(Math.max(1, result.sidebandSpacingHz * 0.03));
    }

    if (!result.fundamentalHz && !result.sidebandSpacingHz) {
      setAutoDetectInfo('Auto-detect could not find stable targets in this frame.');
      return;
    }

    const details = [
      result.fundamentalHz ? `F0 ${result.fundamentalHz.toFixed(2)} Hz` : null,
      result.carrierHz ? `Carrier ${result.carrierHz.toFixed(2)} Hz` : null,
      result.sidebandSpacingHz ? `Spacing ${result.sidebandSpacingHz.toFixed(2)} Hz` : null,
      `Harmonic matches ${result.harmonicMatchCount}`,
      `Sideband pairs ${result.sidebandPairCount}`,
    ].filter(Boolean).join(' | ');

    setAutoDetectInfo(details);
  }, [fftData, minSnr, minFrequency, maxFrequency, maxPeaks]);

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

  const analysisResult = React.useMemo(() => analyzeFrequencies(fftData, {
    minSnr,
    minFrequency,
    maxFrequency,
    maxPeaks,
    fundamentalHz,
    harmonicToleranceCents,
    maxHarmonicOrder,
    sidebandCarrierHz,
    sidebandSpacingHz,
    sidebandToleranceHz,
    sidebandCount,
  }), [
    fftData,
    minSnr,
    minFrequency,
    maxFrequency,
    maxPeaks,
    fundamentalHz,
    harmonicToleranceCents,
    maxHarmonicOrder,
    sidebandCarrierHz,
    sidebandSpacingHz,
    sidebandToleranceHz,
    sidebandCount,
  ]);

  const columns: Column<FrequencyPeakRecord>[] = [
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

  interface HarmonicMatchRecord extends DataRecord {
    order: number;
    expectedFrequency: number;
    matchedFrequency: number;
    amplitude: number;
    detuneHz: number;
    detuneCents: number;
  }

  interface SidebandMatchRecord extends DataRecord {
    side: string;
    index: number;
    expectedFrequency: number;
    matchedFrequency: number;
    amplitude: number;
    offsetHz: number;
    detuneHz: number;
  }

  const harmonicColumns: Column<HarmonicMatchRecord>[] = [
    { header: 'Order', key: 'order' },
    {
      header: 'Expected (Hz)',
      key: 'expectedFrequency',
      render: row => row.expectedFrequency.toFixed(2),
    },
    {
      header: 'Matched (Hz)',
      key: 'matchedFrequency',
      render: row => row.matchedFrequency.toFixed(2),
    },
    {
      header: 'Detune (Hz)',
      key: 'detuneHz',
      render: row => row.detuneHz.toFixed(2),
    },
    {
      header: 'Detune (cents)',
      key: 'detuneCents',
      render: row => row.detuneCents.toFixed(1),
    },
    {
      header: 'Amplitude',
      key: 'amplitude',
      render: row => formatAmplitude(row.amplitude),
    },
  ];

  const sidebandColumns: Column<SidebandMatchRecord>[] = [
    { header: 'Side', key: 'side' },
    { header: 'n', key: 'index' },
    {
      header: 'Expected (Hz)',
      key: 'expectedFrequency',
      render: row => row.expectedFrequency.toFixed(2),
    },
    {
      header: 'Matched (Hz)',
      key: 'matchedFrequency',
      render: row => row.matchedFrequency.toFixed(2),
    },
    {
      header: 'Offset from carrier (Hz)',
      key: 'offsetHz',
      render: row => row.offsetHz.toFixed(2),
    },
    {
      header: 'Detune (Hz)',
      key: 'detuneHz',
      render: row => row.detuneHz.toFixed(2),
    },
    {
      header: 'Amplitude',
      key: 'amplitude',
      render: row => formatAmplitude(row.amplitude),
    },
  ];

  const maxAmplitude = fftData.length > 0
    ? fftData.reduce((max, val) => Math.max(max, val.y), -Infinity)
    : 0;
  const minAmplitude = fftData.length > 0
    ? fftData.reduce((min, val) => Math.min(min, val.y), Infinity)
    : 0;
  const medianAmplitude = fftData.length > 0
    ? fftData.map(p => p.y).sort((a, b) => a - b)[Math.floor(fftData.length / 2)]
    : 0;

  const harmonicRows = analysisResult.harmonicSeries as HarmonicMatchRecord[];
  const sidebandRows = analysisResult.sidebands as SidebandMatchRecord[];

  const strongestHarmonicAmplitude = harmonicRows.reduce((max, row) => Math.max(max, row.amplitude), 0);
  const maxAbsDetuneCents = harmonicRows.reduce((max, row) => Math.max(max, Math.abs(row.detuneCents)), 0);
  const maxAbsSidebandOffset = sidebandRows.reduce((max, row) => Math.max(max, Math.abs(row.offsetHz)), 0);
  const maxSidebandAmplitude = sidebandRows.reduce((max, row) => Math.max(max, row.amplitude), 0);

  const sidebandBalance = React.useMemo(() => {
    const lower = sidebandRows.filter(row => row.side === 'lower').length;
    const upper = sidebandRows.filter(row => row.side === 'upper').length;
    const total = lower + upper;
    if (total === 0) return 0;
    return Math.round((100 * Math.min(lower, upper)) / Math.max(lower, upper));
  }, [sidebandRows]);

  const harmonicPolylinePoints = React.useMemo(() => {
    if (harmonicRows.length === 0) return '';
    const width = 240;
    const height = 80;
    const detuneRange = Math.max(10, maxAbsDetuneCents);
    return harmonicRows
      .map((row, i) => {
        const x = harmonicRows.length === 1 ? 0 : (i / (harmonicRows.length - 1)) * width;
        const y = height / 2 - (row.detuneCents / detuneRange) * (height / 2 - 8);
        return `${x},${y}`;
      })
      .join(' ');
  }, [harmonicRows, maxAbsDetuneCents]);

  React.useEffect(() => {
    if (fftData.length === 0) return;

    const harmonicCoverage = Math.min(
      1,
      maxHarmonicOrder > 0 ? harmonicRows.length / maxHarmonicOrder : 0
    );
    const detuneQuality = 1 - Math.min(1, maxAbsDetuneCents / 60);
    const frame: StabilityFrame = {
      harmonicCoverage,
      sidebandBalance: sidebandBalance / 100,
      detuneQuality,
      fundamentalHz: analysisResult.selectedFundamentalHz,
      spacingHz: sidebandSpacingHz,
    };

    const maxFrames = Math.max(8, Math.min(120, historyFrameCount));
    setStabilityHistory(prev => {
      const next = [...prev, frame];
      if (next.length > maxFrames) {
        return next.slice(next.length - maxFrames);
      }
      return next;
    });
  }, [
    fftData,
    harmonicRows.length,
    maxHarmonicOrder,
    maxAbsDetuneCents,
    sidebandBalance,
    analysisResult.selectedFundamentalHz,
    sidebandSpacingHz,
    historyFrameCount,
  ]);

  return (
    <div className="frequency-analyzer">
      <div className="analysis-controls">
        <div className="control-group control-group-wide">
          <button
            type="button"
            className="analysis-button"
            onClick={handleAutoDetect}
            disabled={fftData.length === 0}
          >
            Auto-detect Fundamental + Sidebands
          </button>
          {autoDetectInfo && <small>{autoDetectInfo}</small>}
        </div>
        <div className="control-group">
          <label>Fundamental (Hz)</label>
          <input
            type="number"
            min={1}
            step={0.1}
            value={fundamentalHz}
            onChange={(e) => setFundamentalHz(Number(e.target.value) || 1)}
          />
        </div>
        <div className="control-group">
          <label>Harmonic tolerance (cents)</label>
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            value={harmonicToleranceCents}
            onChange={(e) => setHarmonicToleranceCents(Number(e.target.value) || 1)}
          />
        </div>
        <div className="control-group">
          <label>Max harmonic order</label>
          <input
            type="number"
            min={1}
            max={32}
            step={1}
            value={maxHarmonicOrder}
            onChange={(e) => setMaxHarmonicOrder(Number(e.target.value) || 1)}
          />
        </div>
        <div className="control-group">
          <label>Sideband carrier (Hz)</label>
          <input
            type="number"
            min={1}
            step={0.1}
            value={sidebandCarrierHz}
            onChange={(e) => setSidebandCarrierHz(Number(e.target.value) || 1)}
          />
        </div>
        <div className="control-group">
          <label>Sideband spacing (Hz)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={sidebandSpacingHz}
            onChange={(e) => setSidebandSpacingHz(Number(e.target.value) || 0.1)}
          />
        </div>
        <div className="control-group">
          <label>Sideband tolerance (Hz)</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={sidebandToleranceHz}
            onChange={(e) => setSidebandToleranceHz(Number(e.target.value) || 0.1)}
          />
        </div>
        <div className="control-group">
          <label>Sideband count</label>
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={sidebandCount}
            onChange={(e) => setSidebandCount(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="analysis-info">
        <small>
          Max Amplitude: {formatAmplitude(maxAmplitude)}
          <br />
          Median Amplitude: {formatAmplitude(medianAmplitude)}
          <br />
          Min Amplitude: {formatAmplitude(minAmplitude)}
          <br />
          Noise Floor: {formatAmplitude(analysisResult.stats.noiseFloor)}
          <br />
          Selected Fundamental: {analysisResult.selectedFundamentalHz ? `${analysisResult.selectedFundamentalHz.toFixed(2)} Hz` : 'None'}
          <br />
          Harmonic Matches: {analysisResult.harmonicSeries.length}/{maxHarmonicOrder}
          <br />
          Sideband Matches: {analysisResult.sidebands.length}
        </small>
      </div>

      <div className="analysis-visuals">
        <div className="analysis-card">
          <h4>Harmonic Strength</h4>
          <div className="metric-row">
            <span>Coverage</span>
            <strong>{analysisResult.harmonicSeries.length}/{maxHarmonicOrder}</strong>
          </div>
          <div className="metric-row">
            <span>Max detune</span>
            <strong>{maxAbsDetuneCents.toFixed(1)} cents</strong>
          </div>
          <div className="bars-list">
            {harmonicRows.length === 0 && <div className="empty-viz">No harmonic matches yet.</div>}
            {harmonicRows.map(row => {
              const candidateFundamental = row.matchedFrequency / Math.max(1, row.order);
              const widthPct = strongestHarmonicAmplitude > 0
                ? (row.amplitude / strongestHarmonicAmplitude) * 100
                : 0;
              const isSelected = Math.abs(candidateFundamental - fundamentalHz) <= Math.max(0.5, fundamentalHz * 0.003);
              const detuneColor = Math.abs(row.detuneCents) <= 15
                ? '#2ecc71'
                : Math.abs(row.detuneCents) <= 35
                  ? '#f1c40f'
                  : '#e67e22';
              return (
                <button
                  type="button"
                  className={`bar-row harmonic-row-button${isSelected ? ' is-selected' : ''}`}
                  key={`harmonic-${row.order}`}
                  onClick={() => {
                    setFundamentalHz(candidateFundamental);
                    setAutoDetectInfo(`Fundamental set from ${row.order}x harmonic -> ${candidateFundamental.toFixed(2)} Hz`);
                  }}
                  title={`Use ${row.order}x harmonic as F0 candidate (${candidateFundamental.toFixed(2)} Hz)`}
                >
                  <span className="bar-label">{row.order}x</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${widthPct}%`, background: detuneColor }} />
                  </div>
                  <span className="bar-value">{row.detuneCents.toFixed(1)}c</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="analysis-card">
          <h4>Detune Trend</h4>
          {harmonicRows.length === 0 ? (
            <div className="empty-viz">No data to draw detune trend.</div>
          ) : (
            <svg viewBox="0 0 240 90" className="detune-chart" role="img" aria-label="Harmonic detune trend">
              <line x1="0" y1="45" x2="240" y2="45" className="detune-axis" />
              <polyline points={harmonicPolylinePoints} className="detune-line" />
              {harmonicRows.map((row, i) => {
                const x = harmonicRows.length === 1 ? 0 : (i / (harmonicRows.length - 1)) * 240;
                const detuneRange = Math.max(10, maxAbsDetuneCents);
                const y = 45 - (row.detuneCents / detuneRange) * 37;
                return <circle key={`detune-${row.order}`} cx={x} cy={y} r="3" className="detune-point" />;
              })}
            </svg>
          )}
          <div className="caption">Zero line centered. Up/down indicates sharp/flat harmonics.</div>
        </div>

        <div className="analysis-card">
          <h4>Sideband Symmetry</h4>
          <div className="metric-row">
            <span>Balance score</span>
            <strong>{sidebandBalance}%</strong>
          </div>
          <div className="metric-row">
            <span>Max offset</span>
            <strong>{maxAbsSidebandOffset.toFixed(1)} Hz</strong>
          </div>
          {sidebandRows.length === 0 ? (
            <div className="empty-viz">No sidebands detected.</div>
          ) : (
            <div className="sideband-map">
              <div className="sideband-center" />
              {sidebandRows.map((row, idx) => {
                const offset = maxAbsSidebandOffset > 0
                  ? (row.offsetHz / maxAbsSidebandOffset) * 48
                  : 0;
                const bubble = maxSidebandAmplitude > 0
                  ? 8 + Math.round((row.amplitude / maxSidebandAmplitude) * 10)
                  : 8;
                return (
                  <div
                    key={`sideband-${idx}-${row.index}-${row.side}`}
                    className={`sideband-dot ${row.side === 'upper' ? 'upper' : 'lower'}`}
                    style={{ left: `calc(50% + ${offset}%)`, width: `${bubble}px`, height: `${bubble}px` }}
                    title={`${row.side} n=${row.index} offset=${row.offsetHz.toFixed(2)}Hz`}
                  />
                );
              })}
            </div>
          )}
          <div className="caption">Center is carrier. Left/right dots are lower/upper sidebands.</div>
        </div>

        <div className="analysis-card analysis-card-wide">
          <div className="history-header">
            <h4>Stability History</h4>
            <label>
              Frames
              <input
                type="number"
                min={8}
                max={120}
                value={historyFrameCount}
                onChange={(e) => setHistoryFrameCount(Number(e.target.value) || 40)}
              />
            </label>
          </div>
          {stabilityHistory.length === 0 ? (
            <div className="empty-viz">History appears as new analysis frames arrive.</div>
          ) : (
            <div className="history-strip" role="img" aria-label="Harmonic and sideband stability history">
              {stabilityHistory.map((frame, idx) => (
                <div
                  key={`history-${idx}`}
                  className="history-cell"
                  title={`Frame ${idx + 1}: coverage ${(frame.harmonicCoverage * 100).toFixed(0)}%, sideband ${(frame.sidebandBalance * 100).toFixed(0)}%, F0 ${frame.fundamentalHz ? frame.fundamentalHz.toFixed(2) : 'n/a'}Hz`}
                >
                  <div className="history-harm" style={{ height: `${Math.round(frame.harmonicCoverage * 100)}%` }} />
                  <div className="history-sideband" style={{ height: `${Math.round(frame.sidebandBalance * 100)}%` }} />
                  <div className="history-detune" style={{ bottom: `${Math.round(frame.detuneQuality * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
          <div className="caption">Left to right: older to newer frames. Green=harmonics, blue=sideband balance, dot=detune quality.</div>
        </div>
      </div>

      <DataTable<FrequencyPeakRecord>
        data={analysisResult.peaks as FrequencyPeakRecord[]}
        columns={columns}
        title="Frequency Analysis"
        className="frequency-table"
      />

      <DataTable<HarmonicMatchRecord>
        data={analysisResult.harmonicSeries as HarmonicMatchRecord[]}
        columns={harmonicColumns}
        title="Harmonic Series Matches"
        className="frequency-table"
      />

      <DataTable<SidebandMatchRecord>
        data={analysisResult.sidebands as SidebandMatchRecord[]}
        columns={sidebandColumns}
        title="Sideband Matches"
        className="frequency-table"
      />
    </div>
  );
};

export default React.memo(FrequencyAnalyzer);
