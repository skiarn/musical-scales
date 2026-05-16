"use client";

import styles from "./page.module.css";
import { useEffect, useMemo, useState } from "react";
import { FuncFilter, FuncTransform, FuncZoom } from "./components/visualization/WaveView";
// import { HarmonicsData } from "./components/analysis/ai/harmonics_autoencoder";
import TabbedDataView from "./components/TabbedDataView";
import type { AudioClip } from "./types/types";

export default function Home() {
  const DEFAULT_SAMPLE_RATE = 800;
  //const DEFAULT_MIN_FREQ = 0;
  
  const [data, setData] = useState<Float32Array<ArrayBufferLike>>(new Float32Array());
  const [dataPresented, setDataPresented] = useState<{ x: number; y: number }[]>([]);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);

  // When the sequencer (AudioSequencer) reports a selection, handle it here.
  const handleSequenceSelected = (clip: AudioClip | null) => {
    console.log('handleSequenceSelected', clip);
  };

  const [windowFunction, setWindowFunction] = useState<FuncFilter<{ x: number; y: number }> | null>(null);
  const [zoomFunction, setZoomFunction] = useState<FuncZoom<{ x: number; y: number }> | null>(null);
  const [transformFunction, setTransformFunction] = useState<FuncTransform<{ x: number; y: number }> | null>(null);
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const [zoomTo, setZoomTo] = useState<number | null>(null);

  // const [harmonicsData, setHarmonicsData] = useState<HarmonicsData | null>(null);
  // console.log("Harmonics Data:", harmonicsData);
  // const [browserInference] = useState<BrowserInference>(new BrowserInference());

  const onNewData = (newData: Float32Array<ArrayBufferLike>, newSampleRate: number) => {
    setData(newData);
    setSampleRate(newSampleRate);
  };

  const onWindowFilterChange = (window: string, enabled: boolean, funcWindow: FuncFilter<{ x: number; y: number }>) => {
      if (enabled) {
        console.log("Applying window filter:", window);
        setWindowFunction(() => funcWindow);
      } else {
        console.log("Removing window filter:", window);
        setWindowFunction(null);
      }
  }
  
  const onZoomChange = (reset: boolean, from: number, to: number, funcZoom: FuncZoom<{ x: number; y: number }>) => {
    if (reset) {
      console.log("Resetting zoom");
      setZoomFunction(null);
      setZoomFrom(null);
      setZoomTo(null);
      return;
    }
    setZoomFunction(() => funcZoom);
    setZoomFrom(from);
    setZoomTo(to);
  }

  const onTransformation = (transformation: string, enabled: boolean, funcTransform: FuncTransform<{ x: number; y: number }>) => {
   if (!enabled) {
      console.log("Removing transformation:", transformation);
      setTransformFunction(null);
      return;
    }
    console.log("Applying transformation:", transformation);
    setTransformFunction(() => funcTransform);
  };

  useEffect(() => {
    if (data.length > 0) {
      const audioData = Array.from(data).map((value, index) => ({
        x: index / sampleRate,
        y: value,
      }));
    
      let newData = audioData;
      if (zoomFunction && zoomFrom !== null && zoomTo !== null) {
        console.log("Applying zoom from", zoomFrom, "to", zoomTo);
        newData = zoomFunction(newData, zoomFrom, zoomTo);
      }

      if (windowFunction) {
        console.log("Applying window function");
        newData = windowFunction(newData);
      }

      if (transformFunction) {
        console.log("Data before transformation function", newData);
        newData = transformFunction(newData);
        console.log("Data after transformation function", newData);
      }

      setDataPresented(newData);
    }
  }
  , [data, sampleRate, zoomFunction, zoomFrom, zoomTo, windowFunction, transformFunction]);

  const audioClipFromData = useMemo<AudioClip | null>(() => {
    if (!dataPresented || dataPresented.length === 0) return null;
    const duration = Math.max(0.01, dataPresented.length / sampleRate);
    const audioContext = new (window.AudioContext || (window as Window).webkitAudioContext)();
    const floatData = Float32Array.from(dataPresented.map(d => d.y)); // just the amplitude values
    const buffer = audioContext.createBuffer(
      1,                     
      floatData.length,   
      sampleRate
    );

    buffer.copyToChannel(floatData, 0); // copy waveform
    return {
      id: `data-${Date.now()}`,
      chord: 'custom',
      start: 0,
      duration,
      color: '#8B5CF6',
      buffer,
      // no buffer / peaks here; consumers can decide how to fetch/compute
    } as AudioClip;
  }, [dataPresented, sampleRate]);

  //  useEffect(() => {
  //    const analyzeHarmonics = async () => {
  //      if (dataPresented.length > 0) {
  //        const result = await browserInference.analyzeWaveform(dataPresented);
  //        setHarmonicsData(result);
  //      }
  //    };
  //    analyzeHarmonics();
  // }, [dataPresented, browserInference]);

  return (
    <div className={styles.main}>
        <TabbedDataView
          className="tab-container"
          onZoomChange={onZoomChange}
          data={dataPresented}
          sampleRate={sampleRate}
          onTransform={onTransformation}
          setNewData={onNewData}
          onWindowFilterChange={onWindowFilterChange}
          // New props: pass a lightweight AudioClip generated from dataPresented,
          // and a callback to receive clip selections from the sequencer.
          externalClip={audioClipFromData}
          onSequenceSelected={handleSequenceSelected}
        />
         {/* <DataView
           onZoomChange={onZoomChange}
           data={dataPresented}
           sampleRate={sampleRate}
           onTransform={onTransformation}
           setNewData={onNewData}
           onWindowFilterChange={onWindowFilterChange}
         ></DataView> */}

        {/* {harmonicsData && (
          <div className={styles.harmonics}>
            <h3>Harmonics Analysis</h3>
            <p>Fundamental Frequency: {harmonicsData.fundamentalFreq.toFixed(2)} Hz</p>
            <div className={styles.harmonicBars}>
              {harmonicsData.harmonicAmplitudes.map((amp, i) => (
                <div 
                  key={i} 
                  className={styles.harmonicBar}
                  style={{ height: `${amp * 100}px` }}
                />
              ))}
            </div>
          </div> }
        )}*/}
      
       {/* Scrollable content below tabs */}
  <div className="tab-content-wrapper">
    {/* Place your content inside tabs normally */}
  </div>
  
      <footer className={styles.footer}>
        Sounds Good
      </footer>
    </div>
  );
}
