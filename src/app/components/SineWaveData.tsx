"use client";

import React from 'react';
import { computeFFT } from '../utils/fft';

const generateSineWaveData = (points: number, amplitude: number, frequency: number, sampleRate: number) => {
  const data = [];
  const dt = 1 / sampleRate; // Time step based on sample rate
  for (let i = 0; i < points; i++) {
    const x = i * dt;
    const y = amplitude * Math.sin(2 * Math.PI * frequency * x);
    data.push({ x, y });
  }
  return data;
};

export const SineWaveData: React.FC<{ points: number, amplitude: number, frequency: number, sampleRate: number, onDataGenerated: (data: {x: number, y: number}[], dataFFT: {frequency: number, amplitude: number}[]) => void }> = ({ points, amplitude, frequency, sampleRate, onDataGenerated }) => {
  React.useEffect(() => {
    const data = generateSineWaveData(points, amplitude, frequency, sampleRate);
    const dataFFT = computeFFT(data, sampleRate);
    onDataGenerated(data, dataFFT);
  }, [points, amplitude, frequency, sampleRate, onDataGenerated]);

  return null; // This component does not render anything
};
