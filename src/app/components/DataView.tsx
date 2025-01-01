import React, { useState, useCallback } from 'react';
import WaveView from './WaveView';
import { SineWaveData } from './SineWaveData';
import AudioRecorder from './AudioRecorder';
import FFTView from './FFTWaveView';
import './DataView.css';
import { computeFFT, transformFFTData, filterFFTData } from '../utils/fft';

const DataView: React.FC = () => {
  const DEFAULT_SAMPLE_RATE = 800;
  const DEFAULT_MIN_FREQ = 0;
  const DEFAULT_MAX_FREQ = DEFAULT_SAMPLE_RATE / 2; // Nyquist frequency

  const [data, setData] = useState<{ x: number, y: number }[]>([]);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);
  const [dataFFT, setDataFFT] = useState<{ x: number, y: number }[]>([]);
  const [minFreq, setMinFreq] = useState(DEFAULT_MIN_FREQ);
  const [maxFreq, setMaxFreq] = useState(DEFAULT_MAX_FREQ);
  const [defaultMaxFreq, setDefaultMaxFreq] = useState(DEFAULT_MAX_FREQ);

  const handleDataGenerated = useCallback((data: { x: number, y: number }[], fftData: { frequency: number, amplitude: number }[]) => {
    setData(data);
    setDataFFT(transformFFTData(fftData));
  }, []);

  const handleAudioStop = (channelData: Float32Array, sampleRate: number) => {
    const audioData = Array.from(channelData).map((value, index) => ({
      x: index / sampleRate,
      y: value,
    }));
    setSampleRate(sampleRate);
    const fftData = computeFFT(audioData, sampleRate);
    setData(audioData);
    setDefaultMaxFreq(fftData[fftData.length-1].frequency)
    setMaxFreq(fftData[fftData.length-1].frequency);
    setDataFFT(transformFFTData(fftData));
  };

  const handleOnSelection = (selectedData: { x: number, y: number }[]) => {
    const fftData = computeFFT(selectedData, sampleRate);
    setDataFFT(transformFFTData(fftData));
  };

  const handleMinFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value >= 0 && value < maxFreq) {
      setMinFreq(value);
    }
  };

  const handleMaxFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value > minFreq && value <= defaultMaxFreq) {
      setMaxFreq(value);
    }
  };

  const handleFilterChange = () => {
    const fftData = computeFFT(data, sampleRate);
    const filteredFFT = filterFFTData(fftData, sampleRate, minFreq, maxFreq);
    setDataFFT(transformFFTData(filteredFFT.amplitudes));
  };

  return (
    <div>
      <h1>Wave Plot</h1>
      <SineWaveData 
        points={DEFAULT_SAMPLE_RATE}
        amplitude={1}
        frequency={10}
        sampleRate={DEFAULT_SAMPLE_RATE}
        onDataGenerated={handleDataGenerated}
      />
      <WaveView data={data} onSelection={handleOnSelection}/>

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
        <label>
          Max Frequency:
          <input
            type="range"
            min="0"
            max={defaultMaxFreq}
            value={maxFreq}
            onChange={handleMaxFreqChange}
          />
          <span>{maxFreq} Hz</span>
        </label>
        <button className="button-apply" onClick={handleFilterChange}>Apply Filter</button>
      </div>

      <h1>FFT Plot</h1>
      <FFTView data={dataFFT} />
      <AudioRecorder onStop={handleAudioStop} />
    </div>
  );
};

export default DataView;
