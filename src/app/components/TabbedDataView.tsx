import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import WaveView, { FuncFilter, FuncTransform, FuncZoom } from "./visualization/WaveView";
import AudioRecorder from "./audio/AudioRecorder";
import FFTView from "./visualization/FFTWaveView";
import "./DataView.css";
import { computeFFT, transformFFTData } from "../utils/fft";
import { GuitarSection } from "./guitar/GuitarSection";
import FrequencyFilter from "./filters/FrequencyFilter";
import WaveformFilter from "./filters/WaveformFilter";
import type { WaveFilterType } from "./filters/WaveformFilter";
import FrequencyAnalyzer from "./analysis/FrequencyAnalyzer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./layout/tabs";
import AudioSequencer from "./audio/AudioSequencer";
import type { AudioClip } from "../types/types";
import ChordTrainer from "./guitar/ChordTrainer";
import GuitarMenu from "./guitar/GuitarMenu";

interface TabbedDataViewProps {
    data: { x: number; y: number }[];
    sampleRate: number;
    setNewData: (data: Float32Array<ArrayBufferLike>, sampleRate: number) => void;
    onTransform: (
        transformation: string,
        enabled: boolean,
        funcTransform: FuncTransform<{ x: number; y: number }>
    ) => void;
    onWindowFilterChange: (
        window: string,
        enabled: boolean,
        funcWindow: FuncFilter<{ x: number; y: number }>
    ) => void;
    onZoomChange?: (
        reset: boolean,
        from: number,
        to: number,
        funcZoom: FuncZoom<{ x: number; y: number }>
    ) => void;
    className?: string;
    // New optional props forwarded to child AudioSequencer
    externalClip?: AudioClip | null;
    onSequenceSelected?: (clip: AudioClip | null) => void;
}

async function loadAudioFileToData(
    url: string,
    setNewData: (data: Float32Array<ArrayBufferLike>, sampleRate: number) => void
) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    console.log(`Loaded audio file from ${url} with sample rate ${sampleRate} and ${channelData.length} samples.`);

    setNewData(channelData, sampleRate);
}

const TabbedDataView: React.FC<TabbedDataViewProps> = ({
    data,
    sampleRate,
    setNewData,
    onWindowFilterChange,
    onZoomChange,
    onTransform,
    className,
    externalClip,
    onSequenceSelected
}) => {

    const defaultMaxFreq = useMemo(() => {
        if (!data || data.length === 0) return sampleRate / 2;
        const N = Math.max(1, data.length);
        const paddedLength = 2 ** Math.ceil(Math.log2(N));
        const lastBinIdx = paddedLength / 2 - 1;
        return lastBinIdx * sampleRate / paddedLength;
    }, [data, sampleRate]);

    const [dataFFT, setDataFFT] = useState<{ x: number; y: number }[]>([]);
    const [maxFreq, setMaxFreq] = useState<number>(defaultMaxFreq);
    const [minFreq, setMinFreq] = useState(0);
    /** Waveform tab: filtered copy of `data` produced by WaveformFilter (display-only). */
    const [filteredWaveData, setFilteredWaveData] = useState<{ x: number; y: number }[]>([]);
    /** Persisted WaveformFilter selections — kept here so they survive tab switches. */
    const [waveFilterType, setWaveFilterType] = useState<WaveFilterType>("none");
    const [waveCutoffHz, setWaveCutoffHz] = useState(1000);

    /**
     * Active filter/transform functions currently enabled inside WaveView's menu
     * (hanning window, velocity, etc.). Stored in refs to avoid re-render churn;
     * `waveViewVersion` is bumped to trigger dependent memos when they change.
     */
    const activeWaveFiltersRef = useRef<Map<string, FuncFilter<{ x: number; y: number }>>>(new Map());
    const activeWaveTransformsRef = useRef<Map<string, FuncTransform<{ x: number; y: number }>>>(new Map());
    const [waveViewVersion, setWaveViewVersion] = useState(0);

    /** Intercepts WaveView's onFilter, captures the function, then forwards to the parent prop. */
    const handleWaveFilter = useCallback(
        (window: string, enabled: boolean, func: FuncFilter<{ x: number; y: number }>) => {
            if (enabled) activeWaveFiltersRef.current.set(window, func);
            else activeWaveFiltersRef.current.delete(window);
            setWaveViewVersion(v => v + 1);
            onWindowFilterChange(window, enabled, func);
        },
        [onWindowFilterChange]
    );

    /** Intercepts WaveView's onTransform, captures the function, then forwards to the parent prop. */
    const handleWaveTransform = useCallback(
        (transformation: string, enabled: boolean, func: FuncTransform<{ x: number; y: number }>) => {
            if (enabled) activeWaveTransformsRef.current.set(transformation, func);
            else activeWaveTransformsRef.current.delete(transformation);
            setWaveViewVersion(v => v + 1);
            onTransform(transformation, enabled, func);
        },
        [onTransform]
    );

    /**
     * Data as it appears in WaveView: WaveformFilter output with all of WaveView's
     * active transforms (velocity) and filters (hanning window) applied on top.
     * This is used as the input to computeFFT so the spectrum reflects what is
     * actually displayed in the waveform plot.
     */
    const fftInputData = useMemo(() => {
        // Start from WaveformFilter output (or raw data if no waveform filter is active)
        let processed: { x: number; y: number }[] = filteredWaveData.length > 0 ? filteredWaveData : data;
        // Apply WaveView transforms (e.g. velocity)
        for (const fn of activeWaveTransformsRef.current.values()) processed = fn(processed);
        // Apply WaveView window filters (e.g. hanning)
        for (const fn of activeWaveFiltersRef.current.values()) processed = fn(processed);
        return processed;
        // waveViewVersion drives re-computation when WaveView filters toggle
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, filteredWaveData, waveViewVersion]);

    const [isPlayingWave, setIsPlayingWave] = useState(false);
    const waveSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const waveAudioCtxRef = useRef<AudioContext | null>(null);

    const stopWavePlayback = useCallback(() => {
        waveSourceRef.current?.stop();
        waveSourceRef.current = null;
        waveAudioCtxRef.current?.close();
        waveAudioCtxRef.current = null;
        setIsPlayingWave(false);
    }, []);

    const playWaveform = useCallback(() => {
        if (isPlayingWave) {
            stopWavePlayback();
            return;
        }
        const waveData = filteredWaveData.length > 0 ? filteredWaveData : data;
        if (waveData.length === 0) return;

        const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, waveData.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < waveData.length; i++) channelData[i] = waveData[i].y;

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsPlayingWave(false);
        source.start();

        waveSourceRef.current = source;
        waveAudioCtxRef.current = audioCtx;
        setIsPlayingWave(true);
    }, [isPlayingWave, filteredWaveData, data, sampleRate, stopWavePlayback]);

    // Stop playback when the source data changes
    useEffect(() => { stopWavePlayback(); }, [data]);

    const worker = useMemo(() => {
        if (typeof window !== "undefined") {
            return new Worker(new URL("../workers/fft.worker.ts", import.meta.url));
        }
    }, []);

    useEffect(() => {
        if (!worker) return;

        worker.onmessage = (e) => {
            setDataFFT(transformFFTData(e.data.filteredFFT.amplitudes));
            console.log('FFT worker response:', e.data);
        };

        return () => worker.terminate();
    }, [worker]);

    useEffect(() => {
        if (fftInputData.length > 0) {
            const fftData = computeFFT(fftInputData, sampleRate);
            if (fftData.length === 0) return;

            setMaxFreq(fftData[fftData.length - 1].frequency);
            setDataFFT(transformFFTData(fftData));
            console.log(`Computed FFT with ${fftData.length} frequency bins (from waveView-processed input).`);
        }
    }, [fftInputData, sampleRate]);

    const handleAudioStop = (channelData: Float32Array, sampleRate: number) => {
        setNewData(channelData, sampleRate);
    };

    const filterChange = useCallback(
        (_fftData: { x: number; y: number }[], min: number, max: number) => {
            setMaxFreq(max);
            setMinFreq(min);
        },
        []
    );

    return (
        <Tabs defaultValue="guitar" className={className}>
            <TabsList className="mb-4">
                <TabsTrigger value="guitar">🎸 Guitar</TabsTrigger>
                <TabsTrigger value="wave">📈 Waveform</TabsTrigger>
                <TabsTrigger value="fft">🔊 FFT</TabsTrigger>
                <TabsTrigger value="analysis">🔍 Analysis</TabsTrigger>
            </TabsList>


            <TabsContent value="guitar">
                <GuitarMenu
                    analytical={<><GuitarSection
                        fftData={dataFFT}
                        minSnr={3}
                        onNoteSelect={(note) => {
                            const url = `${process.env.basePath}/data/guitar/S${note.string}-${note.fret}.m4a`;
                            loadAudioFileToData(url, setNewData);

                            if (note.fret <= 9) {
                                const audio = new Audio(url);
                                audio.play();
                            }
                        }}
                    />
                        <AudioRecorder onStop={handleAudioStop} />
                        <AudioSequencer
                            externalClip={externalClip}
                            onSequenceSelected={onSequenceSelected}
                        />
                    </>}
                    practice={<ChordTrainer />}
                />




            </TabsContent>

            <TabsContent value="wave">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <h1 style={{ margin: 0 }}>Wave Plot</h1>
                    <button
                        onClick={playWaveform}
                        disabled={data.length === 0}
                        style={{
                            padding: "0.3rem 1rem",
                            borderRadius: "4px",
                            border: "1px solid #555",
                            background: isPlayingWave ? "#c0392b" : "#27ae60",
                            color: "#fff",
                            cursor: data.length === 0 ? "not-allowed" : "pointer",
                            fontSize: "0.9rem",
                        }}
                    >
                        {isPlayingWave ? "⏹ Stop" : "▶ Play"}
                    </button>
                </div>
                <WaveformFilter
                    data={data}
                    sampleRate={sampleRate}
                    filterType={waveFilterType}
                    cutoffHz={waveCutoffHz}
                    onFilterTypeChange={setWaveFilterType}
                    onCutoffChange={setWaveCutoffHz}
                    onFilteredData={setFilteredWaveData}
                />
                <WaveView
                    data={filteredWaveData.length > 0 ? filteredWaveData : data}
                    onTransform={handleWaveTransform}
                    onZoom={(reset, from, to, funcZoom) => {
                        console.log("Zoom function applied");
                        if (onZoomChange) {
                            onZoomChange(reset, from, to, funcZoom);
                        }
                    }}
                    onFilter={handleWaveFilter}
                    options={{ filter: { windows: ["hanning"] } }}
                />
            </TabsContent>

            <TabsContent value="fft">
                <h1>FFT Plot</h1>
                <FrequencyFilter
                    defaultMaxFreq={defaultMaxFreq}
                    data={data}
                    sampleRate={sampleRate}
                    onFilterChange={filterChange}
                />
                <FFTView data={dataFFT.filter(point => point.x >= minFreq && point.x <= maxFreq)} />
            </TabsContent>

            <TabsContent value="analysis">
                <h1>Frequency Analysis</h1>
                <FrequencyAnalyzer
                    fftData={dataFFT}
                    minSnr={3}
                    minFrequency={20}
                    maxFrequency={maxFreq}
                    maxPeaks={10}
                />
            </TabsContent>
        </Tabs>
    );
};

export default TabbedDataView;
