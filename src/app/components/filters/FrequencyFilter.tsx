import React, { useCallback, useState, useEffect, useRef } from 'react';
import { transformFFTData, computeFFT, filterFFTData } from '../../utils/fft';

interface FrequencyFilterProps {
  defaultMaxFreq: number;
  data: { x: number, y: number }[];
  sampleRate: number;
  onFilterChange: (fftData: { x: number, y: number }[], min: number, max: number) => void;
}

const FrequencyFilter: React.FC<FrequencyFilterProps> = ({
  defaultMaxFreq,
  data,
  sampleRate,
  onFilterChange
}) => {
  const [minFreq, setMinFreq] = useState(0);
  const [maxFreq, setMaxFreq] = useState(defaultMaxFreq);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | undefined>(undefined);

  const createWorker = () => {
    if (typeof window === 'undefined') return undefined;
    try {
      return new Worker(new URL('../../workers/fft.worker.ts', import.meta.url));
    } catch (err) {
      console.error('Failed to create FFT worker', err);
      return undefined;
    }
  };

  useEffect(() => {
    // lazy-init worker and store in ref
    workerRef.current = createWorker();
    const w = workerRef.current;
    if (!w) return;

    w.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress(msg.progress ?? 0);
        setStatus(msg.status ?? null);
        if (msg.progress === 100) {
          setIsProcessing(false);
          if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        }
      } else if (msg.type === 'result') {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        try {
          onFilterChange(transformFFTData(msg.filteredFFT.amplitudes), msg.minFreq, msg.maxFreq);
        } catch (err) {
          console.error('Error handling worker result', err);
        }
        setIsProcessing(false);
        setProgress(100);
        setStatus('done');
      } else if (msg.type === 'error') {
        console.error('Worker error message:', msg.message);
        setIsProcessing(false);
        setStatus('error');
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      } else {
        // legacy single-message format
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        console.log('FFT worker response (legacy):', msg);
        try {
          onFilterChange(transformFFTData(msg.filteredFFT.amplitudes), msg.minFreq, msg.maxFreq);
        } catch (err) {
          console.error('Error handling legacy worker response', err);
        }
        setIsProcessing(false);
        setProgress(100);
        setStatus('done');
      }
    };

    w.onerror = (err) => {
      console.error('FFT worker error', err);
      setIsProcessing(false);
      setStatus('error');
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };

    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      w.terminate();
      workerRef.current = undefined;
    };
  }, [onFilterChange]);

  const handleMinFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value >= 0 && value < maxFreq) {
      setMinFreq(value);
    }
  };

  const handleMaxFreqChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value > minFreq && value <= defaultMaxFreq) {
      setMaxFreq(value);
    }
  }, [minFreq, defaultMaxFreq]);

  const handleFilterClick = (min: number, max: number) => {

    console.log('Applying filter with minFreq:', min, 'maxFreq:', max);
    if (isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus('starting');

    const w = workerRef.current;
    if (w) {
      try {
        w.postMessage({ data, sampleRate, minFreq: min, maxFreq: max });

        timeoutRef.current = window.setTimeout(() => {
          console.error('FFT worker timed out');
          setIsProcessing(false);
          setStatus('timeout');
          timeoutRef.current = null;
        }, 10000);
      } catch (err) {
        console.error('Error posting to FFT worker, falling back to main thread', err);
        setIsProcessing(false);
        setStatus('fallback');
        try {
          const fftData = computeFFT(data, sampleRate);
          // filter in chunks on main thread to update progress
          const total = fftData.length;
          const amplitudes = fftData.map(p => ({ frequency: p.frequency, amplitude: p.amplitude }));
          let idx = 0;
          const chunkSize = 256;

          const processChunk = () => {
            const end = Math.min(total, idx + chunkSize);
            for (; idx < end; idx++) {
              if (amplitudes[idx].frequency < min || amplitudes[idx].frequency > max) {
                amplitudes[idx].amplitude = 0;
              }
            }
            setProgress(Math.min(95, 40 + Math.round((idx / total) * 55)));
            setStatus('filtering');
            if (idx < total) {
              setTimeout(processChunk, 0);
            } else {
              setProgress(100);
              setStatus('done');
              onFilterChange(transformFFTData(amplitudes), min, max);
              setIsProcessing(false);
            }
          };

          processChunk();
        } catch (innerErr) {
          console.error('Local FFT fallback error', innerErr);
          setIsProcessing(false);
          setStatus('error');
        }
      }
      return;
    }

    // No worker: do computation on main thread (fallback)
    try {
      setStatus('local');
      const fftData = computeFFT(data, sampleRate);
      const filteredFFT = filterFFTData(fftData, sampleRate, min, max);
      onFilterChange(transformFFTData(filteredFFT.amplitudes), min, max);
    } catch (err) {
      console.error('Local FFT error', err);
      setStatus('error');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const handleCancel = () => {
    const w = workerRef.current;
    if (w) {
      try { w.terminate(); } catch { /* noop */ }
      workerRef.current = createWorker();
    }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setIsProcessing(false);
    setStatus('cancelled');
    setProgress(0);
  };

  return (
    <div>
      <h2>Frequency Filter</h2>
      <div>
        <label>
          Min Frequency:
          <input
            type="range"
            min="0"
            max={defaultMaxFreq}
            value={minFreq}
            onChange={handleMinFreqChange}
          />
          <span>{minFreq} Hz</span>
        </label>
        <label className={isProcessing ? 'processing' : ''}>
          Max Frequency:
          <input
            type="range"
            min="0"
            max={defaultMaxFreq}
            value={maxFreq}
            onChange={handleMaxFreqChange}
            disabled={isProcessing}
          />
          <span>{maxFreq} Hz {isProcessing && '(Processing...)'}</span>
        </label>
        <button 
          className={`button-apply ${isProcessing ? 'loading' : ''}`}
          disabled={isProcessing}
          onClick={() => handleFilterClick(minFreq, maxFreq)}
        >
          {isProcessing ? 'Filtering...' : 'Apply Filter'}
        </button>
        {isProcessing && (
          <button onClick={handleCancel} style={{ marginLeft: 8 }}>Cancel</button>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 8, width: '100%', background: '#222', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#4CAF50', transition: 'width 120ms linear' }} />
        </div>
        <div style={{ marginTop: 4, color: '#A6B1C2' }}>{status ? `${status} (${progress}%)` : ''}</div>
      </div>
    </div>
  );
};

export default FrequencyFilter;
