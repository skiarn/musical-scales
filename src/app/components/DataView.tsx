"use client";

import React, { useState, useCallback } from 'react';
import WaveView from './WaveView';
import { SineWaveData } from './SineWaveData';
import AudioRecorder from './AudioRecorder';
import FFTView from './FFTWaveView';

import { computeFFT, transformFFTData } from '../utils/fft';

const DataView: React.FC = () => {
  const [data, setData] = useState<{ x: number, y: number }[]>([]);
  const [dataFFT, setDataFFT] = useState<{ x: number, y: number }[]>([]);

  const handleDataGenerated = useCallback((data: { x: number, y: number }[], fftData: { frequency: number, amplitude: number }[]) => {
    setData(data);
    setDataFFT(transformFFTData(fftData));
  }, []);

  const handleAudioStop = (channelData: Float32Array, sampleRate: number) => {
    const audioData = Array.from(channelData).map((value, index) => ({
      x: index / sampleRate,
      y: value,
    }));

    const fftData = computeFFT(audioData, sampleRate);
    setData(audioData);
    setDataFFT(transformFFTData(fftData));
  };

  return (
    <div>
      <h1>Wave Plot</h1>
      <SineWaveData 
        points={800}
        amplitude={1}
        frequency={10}
        sampleRate={800} // Ensure the sample rate is correct
        onDataGenerated={handleDataGenerated}
      />
      <WaveView data={data} />
      <h1>FFT Plot</h1>
      <FFTView data={dataFFT} />
      <AudioRecorder onStop={handleAudioStop} />
    </div>
  );
};

export default DataView;
