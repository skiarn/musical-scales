import React, { useCallback, useState, useEffect } from 'react';
import { transformFFTData } from '../../utils/fft';

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

  const worker = React.useMemo(() => {
    if (typeof Window !== 'undefined') {
      return new Worker(new URL('../../workers/fft.worker.ts', import.meta.url));
    }
  }, []);

  useEffect(() => {
    if (!worker) return;

    worker.onmessage = (e) => {
      console.log('FFT worker response:', e.data);
      onFilterChange(transformFFTData(e.data.filteredFFT.amplitudes), e.data.minFreq, e.data.maxFreq);
      setIsProcessing(false);
    };

    return () => worker.terminate();
  }, [worker, onFilterChange]);

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
      worker?.postMessage({
        data,
        sampleRate,
        minFreq: min,
        maxFreq: max,
      });

    //try {
    //  const fftData = computeFFT(data, sampleRate);
    //  const filteredFFT = filterFFTData(fftData, sampleRate, minFreq, maxFreq);
    //  onFilterChange(transformFFTData(filteredFFT.amplitudes));
    //} finally {
    //  setIsFiltering(false);
    //}
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
      </div>
    </div>
  );
};

export default FrequencyFilter;
