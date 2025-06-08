import React, { useState, useCallback, useEffect, useMemo } from "react";
import WaveView from "./WaveView";
import { SineWaveData } from "./SineWaveData";
import AudioRecorder from "./AudioRecorder";
import FFTView from "./FFTWaveView";
import "./DataView.css";
import { computeFFT, transformFFTData, filterFFTData } from "../utils/fft";
import FrequencyBandAnalysis from "./FrequencyBandAnalysis";
import { GuitarSection } from "./GuitarSection";
import FrequencyFilter from "./FrequencyFilter";
import FrequencyAnalyzer from "./FrequencyAnalyzer";
import GuitarNoteTable from "./GuitarNoteTable";

const DataView: React.FC = () => {
  const DEFAULT_SAMPLE_RATE = 800;
  const DEFAULT_MIN_FREQ = 0;
  const DEFAULT_MAX_FREQ = DEFAULT_SAMPLE_RATE / 2; // Nyquist frequency

  const [data, setData] = useState<{ x: number; y: number }[]>([]);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);
  const [dataFFT, setDataFFT] = useState<{ x: number; y: number }[]>([]);
  const [minFreq, setMinFreq] = useState(DEFAULT_MIN_FREQ);
  const [maxFreq, setMaxFreq] = useState(DEFAULT_MAX_FREQ);
  const [defaultMaxFreq, setDefaultMaxFreq] = useState(DEFAULT_MAX_FREQ);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const worker = useMemo(() => {
    if (typeof Window !== "undefined") {
      return new Worker(new URL("../workers/fft.worker.ts", import.meta.url));
    }
  }, []);

  useEffect(() => {
    if (!worker) return;

    worker.onmessage = (e) => {
      setDataFFT(transformFFTData(e.data.amplitudes));
      setIsProcessing(false);
    };

    return () => worker.terminate();
  }, [worker]);

  const handleDataGenerated = useCallback(
    (
      data: { x: number; y: number }[],
      fftData: { frequency: number; amplitude: number }[]
    ) => {
      setData(data);
      setDataFFT(transformFFTData(fftData));
    },
    []
  );

  const handleAudioStop = (channelData: Float32Array, sampleRate: number) => {
    console.log(
      "Audio data received:",
      channelData.length,
      "Sample rate:",
      sampleRate
    );
    const audioData = Array.from(channelData).map((value, index) => ({
      x: index / sampleRate,
      y: value,
    }));
    setSampleRate(sampleRate);
    const fftData = computeFFT(audioData, sampleRate);
    setData(audioData);
    setDefaultMaxFreq(fftData[fftData.length - 1].frequency);
    setMaxFreq(fftData[fftData.length - 1].frequency);
    setDataFFT(transformFFTData(fftData));
  };

  const handleOnSelection = (selectedData: { x: number; y: number }[]) => {
    const fftData = computeFFT(selectedData, sampleRate);
    setDataFFT(transformFFTData(fftData));
  };

  const handleMinFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (value >= 0 && value < maxFreq) {
      setMinFreq(value);
    }
  };

  const handleMaxFreqChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (value > minFreq && value <= defaultMaxFreq) {
        setMaxFreq(value);
      }
    },
    [minFreq, defaultMaxFreq]
  );

  const handleFilterChange = async () => {
    setIsFiltering(true);
    try {
      // Wrap in setTimeout to allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
      const fftData = computeFFT(data, sampleRate);
      const filteredFFT = filterFFTData(fftData, sampleRate, minFreq, maxFreq);
      setDataFFT(transformFFTData(filteredFFT.amplitudes));
    } finally {
      setIsFiltering(false);
    }
  };

  const filterChange = useCallback((fftData: { x: number; y: number }[]) => {
    setDataFFT(fftData);
  }, []);

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
      <WaveView data={data} onSelection={handleOnSelection} />
      <FrequencyFilter
        defaultMaxFreq={defaultMaxFreq}
        data={data}
        sampleRate={sampleRate}
        onFilterChange={filterChange}
      ></FrequencyFilter>

      <h1>FFT Plot</h1>
      <FFTView data={dataFFT} />

      <FrequencyAnalyzer
        fftData={dataFFT}
        minSnr={3}
        minFrequency={20}
        maxFrequency={maxFreq}
        maxPeaks={10}
      />

      <GuitarSection fftData={dataFFT} minSnr={3}></GuitarSection>

      <AudioRecorder onStop={handleAudioStop} />
      {/*       
      <FrequencyBandAnalysis
        analysis={dataFFT.map((point, index) => ({
          name: `Band ${index + 1}`,
          energies: [point.y],
          trend: point.y > 0.1 ? 'increasing' : 'stable',
        }))}
      /> */}
    </div>
  );
};

export default DataView;
