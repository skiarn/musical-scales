import React, { useState, useCallback, useEffect, useMemo } from "react";
import WaveView, { FuncFilter, FuncZoom } from "./visualization/WaveView";
import AudioRecorder from "./audio/AudioRecorder";
import FFTView from "./visualization/FFTWaveView";
import "./DataView.css";
import { computeFFT, transformFFTData } from "../utils/fft";
import { GuitarSection } from "./guitar/GuitarSection";
import FrequencyFilter from "./filters/FrequencyFilter";
import FrequencyAnalyzer from "./analysis/FrequencyAnalyzer";

interface DataViewProps {
  data: { x: number; y: number }[];
  sampleRate: number;
  setNewData: (data: { x: number; y: number }[], sampleRate: number) => void;
  onWindowFilterChange: (window: string, enabled: boolean, funcWindow: FuncFilter<{ x: number; y: number }>) => void;
  onZoomChange?: (reset: boolean, from: number, to: number, funcZoom: FuncZoom<{ x: number; y: number }>) => void;
}

const DataView: React.FC <DataViewProps> = ({ data, sampleRate, setNewData, onWindowFilterChange, onZoomChange }) => {
const DEFAULT_MAX_FREQ = sampleRate / 2; // Nyquist frequency

  const [dataFFT, setDataFFT] = useState<{ x: number; y: number }[]>([]);
  const [maxFreq, setMaxFreq] = useState(DEFAULT_MAX_FREQ);
  const [minFreq, setMinFreq] = useState(0);

  const worker = useMemo(() => {
    if (typeof Window !== "undefined") {
      return new Worker(new URL("../workers/fft.worker.ts", import.meta.url));
    }
  }, []);

  useEffect(() => {
    if (!worker) return;

    worker.onmessage = (e) => {
      setDataFFT(transformFFTData(e.data.filteredFFT.amplitudes));
    };

    return () => worker.terminate();
  }, [worker]);

  useEffect(() => {
    if (data.length > 0) {
      const fftData = computeFFT(data, sampleRate);
      if (fftData.length === 0) {
        console.warn("FFT data is empty. Ensure that the input data is valid.");
        return;
      }
      setMaxFreq(fftData[fftData.length - 1].frequency);
      const fft = transformFFTData(fftData);
      setDataFFT(fft);
    }
  }, [data, sampleRate]);


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
    
    setNewData(audioData, sampleRate); 
  };


  const filterChange = useCallback((_fftData: { x: number; y: number }[], min: number, max:number) => {
    setMaxFreq(max);
    setMinFreq(min);
  }, []);

  return (
    <div>
      <h1>Wave Plot</h1>
       <WaveView data={data}
       onZoom={(reset, from, to, funcZoom) => {
        console.log("Zoom function applied");
        if (onZoomChange) {
          onZoomChange(reset, from, to, funcZoom);
        }
       }}
       onFilter={(window, enabled, funcWindow) => {
        console.log("Filter applied");
        onWindowFilterChange(window, enabled, funcWindow);
       }} options={{filter: {windows: ["hanning"]}}}/>
      <FrequencyFilter
        defaultMaxFreq={DEFAULT_MAX_FREQ}
        data={data}
        sampleRate={sampleRate}
        onFilterChange={filterChange}
      ></FrequencyFilter>

      <h1>FFT Plot</h1>
      <span>Min:{minFreq} Max:{maxFreq}</span>
      <FFTView data={dataFFT.slice(minFreq, maxFreq)} />

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
