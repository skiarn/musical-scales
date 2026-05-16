import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import WaveView, { FuncFilter, FuncTransform, FuncZoom } from "./visualization/WaveView";
import AudioRecorder from "./audio/AudioRecorder";
import FFTView from "./visualization/FFTWaveView";
import "./DataView.css";
import {
    computeFFT,
    transformFFTData,
    extractFrequencyComponents,
    type ExtractedFrequencyComponent,
} from "../utils/fft";
import { GuitarSection } from "./guitar/GuitarSection";
import FrequencyFilter from "./filters/FrequencyFilter";
import WaveformFilter from "./filters/WaveformFilter";
import type { WaveFilterType } from "./filters/WaveformFilter";
import FrequencyAnalyzer from "./analysis/FrequencyAnalyzer";
import { ComponentEnergyBarChart } from "./analysis/ComponentEnergyBarChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./layout/tabs";
import AudioSequencer from "./audio/AudioSequencer";
import type { AudioClip } from "../types/types";
import ChordTrainer from "./guitar/ChordTrainer";
import GuitarMenu from "./guitar/GuitarMenu";
import WaveExperimentalInput from "./wave/WaveExperimentalInput";

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
    const [componentTopN, setComponentTopN] = useState(5);
    const [componentBandwidthHz, setComponentBandwidthHz] = useState(20);
    const [componentMinSnr, setComponentMinSnr] = useState(3);
    const [componentGainDb, setComponentGainDb] = useState(18);
    const [normalizeComponentAudio, setNormalizeComponentAudio] = useState(true);
    const [frequencyComponents, setFrequencyComponents] = useState<ExtractedFrequencyComponent[]>([]);
    const [activeComponentIndex, setActiveComponentIndex] = useState<number | null>(null);
    const [expandedComponentIndex, setExpandedComponentIndex] = useState<number | null>(null);
    const [isPlayingCombinedComponents, setIsPlayingCombinedComponents] = useState(false);
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
    const componentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const componentAudioCtxRef = useRef<AudioContext | null>(null);

    const stopWavePlayback = useCallback(() => {
        waveSourceRef.current?.stop();
        waveSourceRef.current = null;
        waveAudioCtxRef.current?.close();
        waveAudioCtxRef.current = null;
        setIsPlayingWave(false);
    }, []);

    const stopComponentPlayback = useCallback(() => {
        componentSourceRef.current?.stop();
        componentSourceRef.current = null;
        componentAudioCtxRef.current?.close();
        componentAudioCtxRef.current = null;
        setActiveComponentIndex(null);
        setIsPlayingCombinedComponents(false);
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
    useEffect(() => {
        stopWavePlayback();
        stopComponentPlayback();
    }, [data, stopWavePlayback, stopComponentPlayback]);

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

    useEffect(() => {
        if (fftInputData.length === 0) {
            setFrequencyComponents([]);
            return;
        }

        const components = extractFrequencyComponents(fftInputData, sampleRate, {
            topN: componentTopN,
            minFreq: minFreq,
            maxFreq: maxFreq,
            minSnr: componentMinSnr,
            bandwidthHz: componentBandwidthHz,
        });

        setFrequencyComponents(components);
        if (activeComponentIndex !== null && activeComponentIndex >= components.length) {
            setActiveComponentIndex(null);
        }
        if (expandedComponentIndex !== null && expandedComponentIndex >= components.length) {
            setExpandedComponentIndex(null);
        }
    }, [
        fftInputData,
        sampleRate,
        componentTopN,
        componentBandwidthHz,
        componentMinSnr,
        minFreq,
        maxFreq,
        activeComponentIndex,
        expandedComponentIndex,
    ]);

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

    const playFrequencyComponent = useCallback((index: number) => {
        const component = frequencyComponents[index];
        if (!component) return;

        if (activeComponentIndex === index) {
            stopComponentPlayback();
            return;
        }

        stopComponentPlayback();

        const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, component.waveform.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        const raw = component.waveform.map(point => point.y);
        const peak = raw.reduce((max, value) => Math.max(max, Math.abs(value)), 1e-9);
        const targetPeak = 0.9;
        const normalizeScale = normalizeComponentAudio ? Math.min(8, targetPeak / peak) : 1;
        const gainScale = Math.pow(10, componentGainDb / 20);
        const finalScale = Math.min(12, normalizeScale * gainScale);
        for (let i = 0; i < component.waveform.length; i++) {
            const boosted = raw[i] * finalScale;
            channelData[i] = Math.max(-1, Math.min(1, boosted));
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setActiveComponentIndex(null);
        source.start();

        componentSourceRef.current = source;
        componentAudioCtxRef.current = audioCtx;
        setActiveComponentIndex(index);
    }, [frequencyComponents, activeComponentIndex, sampleRate, stopComponentPlayback, componentGainDb, normalizeComponentAudio]);

    const loadComponentIntoWave = useCallback((index: number) => {
        const component = frequencyComponents[index];
        if (!component) return;
        const raw = component.waveform.map(point => point.y);
        const peak = raw.reduce((max, value) => Math.max(max, Math.abs(value)), 1e-9);
        const normalizeScale = normalizeComponentAudio ? Math.min(8, 0.9 / peak) : 1;
        const gainScale = Math.pow(10, componentGainDb / 20);
        const finalScale = Math.min(12, normalizeScale * gainScale);
        const channelData = new Float32Array(raw.map(value => Math.max(-1, Math.min(1, value * finalScale))));
        setNewData(channelData, sampleRate);
    }, [frequencyComponents, setNewData, sampleRate, componentGainDb, normalizeComponentAudio]);

    const buildCombinedComponentWave = useCallback(() => {
        if (frequencyComponents.length === 0) return null;
        const length = frequencyComponents[0].waveform.length;
        if (length === 0) return null;

        const sum = new Array<number>(length).fill(0);
        for (const component of frequencyComponents) {
            for (let i = 0; i < length; i++) {
                sum[i] += component.waveform[i]?.y ?? 0;
            }
        }

        const peak = sum.reduce((max, value) => Math.max(max, Math.abs(value)), 1e-9);
        const targetPeak = 0.9;
        const normalizeScale = normalizeComponentAudio ? Math.min(8, targetPeak / peak) : 1;
        const gainScale = Math.pow(10, componentGainDb / 20);
        const finalScale = Math.min(12, normalizeScale * gainScale);
        const boosted = sum.map(value => Math.max(-1, Math.min(1, value * finalScale)));

        return new Float32Array(boosted);
    }, [frequencyComponents, componentGainDb, normalizeComponentAudio]);

    const playCombinedFrequencyComponents = useCallback(() => {
        if (isPlayingCombinedComponents) {
            stopComponentPlayback();
            return;
        }

        const combined = buildCombinedComponentWave();
        if (!combined || combined.length === 0) return;

        stopComponentPlayback();
        const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, combined.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        channelData.set(combined);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsPlayingCombinedComponents(false);
        source.start();

        componentSourceRef.current = source;
        componentAudioCtxRef.current = audioCtx;
        setActiveComponentIndex(null);
        setIsPlayingCombinedComponents(true);
    }, [isPlayingCombinedComponents, buildCombinedComponentWave, sampleRate, stopComponentPlayback]);

    const loadCombinedFrequencyComponentsIntoWave = useCallback(() => {
        const combined = buildCombinedComponentWave();
        if (!combined || combined.length === 0) return;
        setNewData(combined, sampleRate);
    }, [buildCombinedComponentWave, setNewData, sampleRate]);

    const buildWavePreviewPath = useCallback((waveform: { x: number; y: number }[], width = 560, height = 140) => {
        if (waveform.length === 0) return "";
        const points = Math.min(420, waveform.length);
        const step = Math.max(1, Math.floor(waveform.length / points));
        const sampled: number[] = [];
        for (let i = 0; i < waveform.length; i += step) sampled.push(waveform[i].y);
        if (sampled.length < 2) return "";

        const maxAbs = sampled.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
        return sampled
            .map((value, i) => {
                const x = (i / (sampled.length - 1)) * width;
                const y = height / 2 - (value / maxAbs) * (height * 0.42);
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
    }, []);

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
                    <button
                        onClick={() => {
                            // Export current waveform as WAV
                            const waveData = filteredWaveData.length > 0 ? filteredWaveData : data;
                            if (!waveData.length) return;
                            // Convert to Float32Array
                            const arr = new Float32Array(waveData.map(p => p.y));
                            // Dynamically import float32ToWav
                            import("../utils/wav").then(({ float32ToWav }) => {
                                const blob = float32ToWav(arr, sampleRate);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "waveform.wav";
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => {
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }, 200);
                            });
                        }}
                        disabled={data.length === 0}
                        style={{
                            padding: "0.3rem 1rem",
                            borderRadius: "4px",
                            border: "1px solid #555",
                            background: "#2980b9",
                            color: "#fff",
                            cursor: data.length === 0 ? "not-allowed" : "pointer",
                            fontSize: "0.9rem",
                        }}
                    >
                        ⬇ Download as WAV
                    </button>
                    <label style={{
                        padding: "0.3rem 1rem",
                        borderRadius: "4px",
                        border: "1px solid #555",
                        background: "#8e44ad",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        marginBottom: 0
                    }}>
                        ⬆ Import WAV/MP4
                        <input
                            type="file"
                            accept="audio/wav, audio/mp4, audio/mpeg, audio/x-m4a, audio/webm, audio/aac, audio/ogg, video/mp4"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const url = URL.createObjectURL(file);
                                await loadAudioFileToData(url, setNewData);
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                                e.target.value = "";
                            }}
                        />
                    </label>
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
                <WaveExperimentalInput onDataCaptured={setNewData} />
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

                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "1rem" }}>
                    <h2 style={{ margin: "0 0 0.5rem" }}>Separated Frequency Components</h2>
                    <p style={{ margin: "0 0 0.6rem", opacity: 0.85 }}>
                        This performs narrow-band demodulation around dominant FFT peaks and reconstructs each component wave.
                    </p>

                    {/* Energy Bar Chart Visualization */}
                    {frequencyComponents.length > 0 && (
                        (() => {
                            // Compute energy for each component and total
                            const energies = frequencyComponents.map(c => c.waveform.reduce((sum, p) => sum + p.y * p.y, 0));
                            // For total, use the sum of all component waveforms (combined)
                            let totalEnergy = 0;
                            if (frequencyComponents[0]?.waveform) {
                                const length = frequencyComponents[0].waveform.length;
                                const sum = new Array(length).fill(0);
                                for (const c of frequencyComponents) {
                                    for (let i = 0; i < length; i++) sum[i] += c.waveform[i]?.y ?? 0;
                                }
                                totalEnergy = sum.reduce((acc, v) => acc + v * v, 0);
                            }
                            return <ComponentEnergyBarChart energies={energies} totalEnergy={totalEnergy} labels={frequencyComponents.map(c => `${c.centerFrequency.toFixed(1)} Hz`)} />;
                        })()
                    )}

                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Components
                            <input
                                type="number"
                                min={1}
                                max={12}
                                value={componentTopN}
                                onChange={(e) => setComponentTopN(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                                style={{ width: "64px" }}
                            />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Bandwidth (Hz)
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={componentBandwidthHz}
                                onChange={(e) => setComponentBandwidthHz(Math.max(1, Number(e.target.value) || 1))}
                                style={{ width: "84px" }}
                            />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Min SNR
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={componentMinSnr}
                                onChange={(e) => setComponentMinSnr(Math.max(1, Number(e.target.value) || 1))}
                                style={{ width: "64px" }}
                            />
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Boost (dB)
                            <input
                                type="range"
                                min={-12}
                                max={36}
                                step={1}
                                value={componentGainDb}
                                onChange={(e) => setComponentGainDb(Number(e.target.value) || 0)}
                            />
                            <span style={{ minWidth: "48px", textAlign: "right" }}>{componentGainDb} dB</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <input
                                type="checkbox"
                                checked={normalizeComponentAudio}
                                onChange={(e) => setNormalizeComponentAudio(e.target.checked)}
                            />
                            Auto normalize
                        </label>
                        <button
                            type="button"
                            onClick={playCombinedFrequencyComponents}
                            disabled={frequencyComponents.length === 0}
                        >
                            {isPlayingCombinedComponents ? "Stop Combined" : "Play Combined"}
                        </button>
                        <button
                            type="button"
                            onClick={loadCombinedFrequencyComponentsIntoWave}
                            disabled={frequencyComponents.length === 0}
                        >
                            Load Combined to Wave
                        </button>
                    </div>

                    {frequencyComponents.length === 0 ? (
                        <small>No dominant components detected in current FFT range.</small>
                    ) : (
                        <div style={{ display: "grid", gap: "0.4rem" }}>
                            {/* Compute energies for per-item bars */}
                            {(() => {
                                const energies = frequencyComponents.map(c => c.waveform.reduce((sum, p) => sum + p.y * p.y, 0));
                                let totalEnergy = 0;
                                if (frequencyComponents[0]?.waveform) {
                                    const length = frequencyComponents[0].waveform.length;
                                    const sum = new Array(length).fill(0);
                                    for (const c of frequencyComponents) {
                                        for (let i = 0; i < length; i++) sum[i] += c.waveform[i]?.y ?? 0;
                                    }
                                    totalEnergy = sum.reduce((acc, v) => acc + v * v, 0);
                                }
                                const COLORS = [
                                    "#4FD1C5", "#66d9ff", "#f6c177", "#e06c75", "#a9a1e1", "#98c379", "#ffb86c", "#ff79c6", "#bd93f9", "#50fa7b", "#ff5555", "#f1fa8c"
                                ];
                                return frequencyComponents.map((component, idx) => (
                                    <div
                                        key={`component-${idx}-${component.centerFrequency}`}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "24px 1fr",
                                            gap: "0.65rem",
                                            padding: "0.45rem 0.6rem",
                                            borderRadius: "6px",
                                            border: "1px solid rgba(255,255,255,0.15)",
                                            background: activeComponentIndex === idx ? "rgba(39,174,96,0.25)" : "rgba(255,255,255,0.03)",
                                            alignItems: "center"
                                        }}
                                        onClick={() => setExpandedComponentIndex(prev => (prev === idx ? null : idx))}
                                    >
                                        {/* Vertical energy bar */}
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "center" }}>
                                            <div
                                                style={{
                                                    width: 12,
                                                    height: `${Math.max(12, 80 * energies[idx] / (totalEnergy || 1e-9))}px`,
                                                    background: COLORS[idx % COLORS.length],
                                                    borderRadius: 3,
                                                    marginBottom: 2,
                                                    marginTop: 2,
                                                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                                                    transition: "height 0.3s"
                                                }}
                                                title={`Energy: ${energies[idx].toExponential(2)} (${((energies[idx] / (totalEnergy || 1e-9)) * 100).toFixed(1)}%)`}
                                            />
                                            <div style={{ fontSize: 10, color: "#bfc9d4", textAlign: "center", maxWidth: 24, wordBreak: "break-all" }}>{((energies[idx] / (totalEnergy || 1e-9)) * 100).toFixed(0)}%</div>
                                        </div>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                                                <div>
                                                    <strong>{component.centerFrequency.toFixed(2)} Hz</strong>
                                                    <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                                                        Amplitude {component.amplitude.toExponential(2)} | SNR {component.snr.toFixed(1)} | {expandedComponentIndex === idx ? "Click to collapse" : "Click to expand wave"}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: "0.45rem" }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playFrequencyComponent(idx);
                                                        }}
                                                    >
                                                        {activeComponentIndex === idx ? "Stop" : "Play"}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            loadComponentIntoWave(idx);
                                                        }}
                                                    >
                                                        Load to Wave
                                                    </button>
                                                </div>
                                            </div>

                                            {expandedComponentIndex === idx && (
                                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.14)", paddingTop: "0.5rem" }}>
                                                    <svg viewBox="0 0 560 140" style={{ width: "100%", height: "120px", display: "block", background: "rgba(10,20,35,0.35)", borderRadius: "6px" }}>
                                                        <line x1="0" y1="70" x2="560" y2="70" stroke="rgba(255,255,255,0.24)" strokeWidth="1" />
                                                        <path d={buildWavePreviewPath(component.waveform)} fill="none" stroke="#66d9ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                                    </svg>
                                                    <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", opacity: 0.85 }}>
                                                        Reconstructed component waveform preview ({component.waveform.length.toLocaleString()} samples)
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
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
