"use client";

import styles from "./page.module.css";
import DataView from "./components/DataView";
import { useCallback, useEffect, useState } from "react";
import { SineWaveData } from "./examples/SineWaveData";
import { FuncFilter, FuncZoom } from "./components/visualization/WaveView";

export default function Home() {
  const DEFAULT_SAMPLE_RATE = 800;
  //const DEFAULT_MIN_FREQ = 0;
  
  const [data, setData] = useState<{ x: number; y: number }[]>([]);
  const [dataPresented, setDataPresented] = useState<{ x: number; y: number }[]>([]);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);

  const [windowFunction, setWindowFunction] = useState<FuncFilter<{ x: number; y: number }> | null>(null);
  const [zoomFunction, setZoomFunction] = useState<FuncZoom<{ x: number; y: number }> | null>(null);
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const [zoomTo, setZoomTo] = useState<number | null>(null);

  const onNewData = (newData: { x: number; y: number }[], newSampleRate: number) => {
    setData(newData);
    setSampleRate(newSampleRate);
  };

  const handleSinusExample = useCallback(
    (
      data: { x: number; y: number }[]
    ) => {
      setData(data);
      setSampleRate(DEFAULT_SAMPLE_RATE);
    },
    [DEFAULT_SAMPLE_RATE]
  );

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

  useEffect(() => {
    if (data.length > 0) {
      let newData = data;
      if (zoomFunction && zoomFrom !== null && zoomTo !== null) {
        console.log("Applying zoom from", zoomFrom, "to", zoomTo);
        newData = zoomFunction(newData, zoomFrom, zoomTo);
      }

      if (windowFunction) {
        console.log("Applying window function");
        newData = windowFunction(newData);
      }

      setDataPresented(newData);
    }
  }
  , [data, zoomFunction, zoomFrom, zoomTo, windowFunction]);
    
  return (
    <div className={styles.page}>
       
      <main className={styles.main}>
      <SineWaveData
        points={DEFAULT_SAMPLE_RATE}
        amplitude={1}
        frequency={10}
        sampleRate={DEFAULT_SAMPLE_RATE}
        onDataGenerated={handleSinusExample}
      />
    
        <DataView
          onZoomChange={onZoomChange}
          data={ dataPresented}
          sampleRate={sampleRate}
          setNewData={onNewData}
          onWindowFilterChange={onWindowFilterChange}
        ></DataView>
      
      </main>
      <footer className={styles.footer}>
        Sounds Good
      </footer>
    </div>
  );
}
