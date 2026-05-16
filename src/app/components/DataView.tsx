import React, { useState, useCallback, useEffect, useMemo } from "react";
import WaveView, { FuncFilter, FuncTransform, FuncZoom } from "./visualization/WaveView";
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
  setNewData: (data: Float32Array<ArrayBufferLike>, sampleRate: number) => void;
  onTransform: (transformation: string, enabled: boolean, funcTransform: FuncTransform<{ x: number; y: number }>) => void;
  onWindowFilterChange: (window: string, enabled: boolean, funcWindow: FuncFilter<{ x: number; y: number }>) => void;
  onZoomChange?: (reset: boolean, from: number, to: number, funcZoom: FuncZoom<{ x: number; y: number }>) => void;
}

async function loadAudioFileToData(url: string, setNewData: (data: Float32Array<ArrayBufferLike>, sampleRate: number) => void) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Use the first channel (mono)
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  setNewData(channelData, sampleRate);
}

const DataView: React.FC <DataViewProps> = ({ data, sampleRate, setNewData, onWindowFilterChange, onZoomChange, onTransform }) => {

const defaultMaxFreq = useMemo(() => {
        if (!data || data.length === 0) return sampleRate / 2;
        const N = Math.max(1, data.length);
        const paddedLength = 2 ** Math.ceil(Math.log2(N));
        const lastBinIdx = paddedLength / 2 - 1;
        return lastBinIdx * sampleRate / paddedLength;
    }, [data, sampleRate]);

  const [dataFFT, setDataFFT] = useState<{ x: number; y: number }[]>([]);
  const [maxFreq, setMaxFreq] = useState(defaultMaxFreq);
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

    setNewData(channelData, sampleRate); 
  };


  const filterChange = useCallback((_fftData: { x: number; y: number }[], min: number, max:number) => {
    setMaxFreq(max);
    setMinFreq(min);
  }, []);

  return (
    <div>
      <GuitarSection fftData={dataFFT} minSnr={3} onNoteSelect={(note) => {
        console.log("Selected note:", note);
        
        const url = `${process.env.basePath}/data/guitar/S${note.string}-${note.fret}.m4a`;
        loadAudioFileToData(url, setNewData);

        if (note.fret <= 9) {
          const audio = new Audio(url);
          audio.play();
          console.log("Playing note:", note);
        }
      }
      } />
      <AudioRecorder onStop={handleAudioStop} />
      <h1>Wave Plot</h1>
       <WaveView data={data}
       onTransform={(transformation, enabled, funcTransform) => {
        console.log("Transformation function applied");
        console.log("Transformation:", transformation, "Enabled:", enabled);
        if (transformation === 'velocity') {
          // Handle velocity transformation
          if(onTransform) {
            onTransform(transformation, enabled, funcTransform);
          }
        }
       }}
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
        defaultMaxFreq={defaultMaxFreq}
        data={data}
        sampleRate={sampleRate}
        onFilterChange={filterChange}
      ></FrequencyFilter>

      <h1>FFT Plot</h1>
      <span>Min:{minFreq} Max:{maxFreq}</span>
      <FFTView data={
        dataFFT.filter(point => point.x >= minFreq && point.x <= maxFreq)
      } />

      <FrequencyAnalyzer
        fftData={dataFFT}
        minSnr={3}
        minFrequency={20}
        maxFrequency={maxFreq}
        maxPeaks={10}
      />

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
