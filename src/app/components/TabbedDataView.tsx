import React, { useState, useCallback, useEffect, useMemo } from "react";
import WaveView, { FuncFilter, FuncTransform, FuncZoom } from "./visualization/WaveView";
import AudioRecorder from "./audio/AudioRecorder";
import FFTView from "./visualization/FFTWaveView";
import "./DataView.css";
import { computeFFT, transformFFTData } from "../utils/fft";
import { GuitarSection } from "./guitar/GuitarSection";
import FrequencyFilter from "./filters/FrequencyFilter";
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
        if (data.length > 0) {
            const fftData = computeFFT(data, sampleRate);
            if (fftData.length === 0) return;

            setMaxFreq(fftData[fftData.length - 1].frequency);
            setDataFFT(transformFFTData(fftData));
            console.log(`Computed FFT with ${fftData.length} frequency bins.`);
        }
    }, [data, sampleRate]);

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
                <h1>Wave Plot</h1>
                <WaveView
                    data={data}
                    onTransform={onTransform}
                    onZoom={(reset, from, to, funcZoom) => {
                        console.log("Zoom function applied");
                        if (onZoomChange) {
                            onZoomChange(reset, from, to, funcZoom);
                        }
                    }}
                    onFilter={onWindowFilterChange}
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
