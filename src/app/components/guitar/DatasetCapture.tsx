"use client";

import React, { useEffect, useRef, useState } from "react";
import { computeFFT } from "../../utils/fft";
import { guitarNotes } from "../../utils/guitar-frequencies";
import { float32ToWav, parseWavMeta } from "../../utils/wav";
import styles from "./DatasetCapture.module.css";
import DatasetCaptureCanvas from "./DatasetCaptureCanvas";
import DatasetCaptureRegions from "./DatasetCaptureRegions";

export interface SampleMetadata {
    dynamics: "soft" | "medium" | "hard";
    technique: "finger" | "pick";
    string_id?: number;
    fret?: number;
    nominal_pitch_hz?: number;
    sample_rate?: number;
}

export interface Region {
    start: number;
    end: number;
    peaks: number[];
};
export interface Captured {
    name: string;
    meta: SampleMetadata & { regions?: Region[] };
    wavBlob?: Blob;
    metaBlob?: Blob;
}

type DynamicValues = "soft" | "medium" | "hard";

type TechniqueValues = "finger" | "pick";

export default function DatasetCapture({ onCaptured }: { onCaptured?: (name: string, meta: SampleMetadata & { regions?: Region[] }, wavBlob?: Blob, metaBlob?: Blob) => void }) {
    const [dynamics, setDynamics] = useState<DynamicValues>("medium");
    const [technique, setTechnique] = useState<TechniqueValues>("pick");
    const [stringId, setStringId] = useState<number | undefined>(undefined);
    const [fret, setFret] = useState<number | undefined>(undefined);
    const [nominalPitchHz, setNominalPitchHz] = useState<number | undefined>(undefined);
    const [captureDuration, setCaptureDuration] = useState<number>(1200);
    const [captureInProgress, setCaptureInProgress] = useState(false);
    const [lastCaptured, setLastCaptured] = useState<Captured | null>(null);
    const [autoDownload, setAutoDownload] = useState(false);
    const [embedMetadata, setEmbedMetadata] = useState(true);
    const [trimEnabled, setTrimEnabled] = useState<boolean>(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const recordShort = (durationMs: number) => {
        return new Promise<Blob>(async (resolve, reject) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                const chunks: Blob[] = [];
                mediaRecorderRef.current.ondataavailable = (e: BlobEvent) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };
                mediaRecorderRef.current.onstop = () => {
                    try { stream.getTracks().forEach((t) => t.stop()); } catch { }
                    resolve(new Blob(chunks, { type: chunks[0]?.type || "audio/webm" }));
                };
                mediaRecorderRef.current.start();
                setTimeout(() => {
                    try { mediaRecorderRef.current?.stop(); } catch (e) { try { stream.getTracks().forEach((t) => t.stop()); } catch { } reject(e); }
                }, durationMs);
            } catch (err) { reject(err); }
        });
    };


    const estimatePitch = async (audioBuffer: AudioBuffer): Promise<number> => {
        const sr = audioBuffer.sampleRate;
        const channel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : audioBuffer.getChannelData(0);
        const N = Math.min(channel.length, sr * 0.5);
        const start = Math.max(0, Math.floor((channel.length - N) / 2));
        const arr: { x: number; y: number }[] = [];
        for (let i = 0; i < N; i++) arr.push({ x: i / sr, y: channel[start + i] });
        const fft = computeFFT(arr, sr);

        interface FreqAmp {
            frequency: number;
            amplitude: number;
        }

        const candidate = fft.filter((f) => f.frequency >= 50 && f.frequency <= 2000).reduce((best, cur) => (cur.amplitude > (best?.amplitude ?? 0) ? cur : best), null as FreqAmp | null);
        return candidate ? candidate.frequency : 0;
    };

    const trimNoise = async (audioBuffer: AudioBuffer) => {
        const sr = audioBuffer.sampleRate;
        const channel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : audioBuffer.getChannelData(0);
        const frameSize = 1024; const hop = 512;
        const rms: number[] = []; const framesFFT: { frequency: number; amplitude: number }[][] = [];
        for (let i = 0; i < channel.length; i += hop) {
            let sum = 0; const arr: { x: number; y: number }[] = [];
            for (let j = i; j < Math.min(i + frameSize, channel.length); j++) { const v = channel[j]; sum += v * v; arr.push({ x: j / sr, y: v }); }
            const mean = sum / Math.min(frameSize, channel.length - i); rms.push(Math.sqrt(mean));
            try { framesFFT.push(computeFFT(arr, sr)); } catch (e) {
                console.error('FFT compute error in trimNoise:', e);
                framesFFT.push([]);
            }
        }
        const sorted = [...rms].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 0; const threshold = Math.max(1e-5, median * 3);
        const ranges: { start: number; end: number; peaks: number[] }[] = [];
        for (let idx = 0; idx < rms.length; idx++) {
            if (rms[idx] >= threshold) {
                const start = Math.max(0, idx * hop - hop);
                const end = Math.min(channel.length, idx * hop + frameSize + hop);
                const fft = framesFFT[idx] || [];
                const peaks = fft.filter(f => f.frequency >= 50 && f.frequency <= 5000).sort((a, b) => b.amplitude - a.amplitude).slice(0, 5).map(p => p.frequency);
                if (ranges.length === 0) ranges.push({ start, end, peaks });
                else { const last = ranges[ranges.length - 1]; if (start <= last.end + hop) { last.end = Math.max(last.end, end); last.peaks = Array.from(new Set([...last.peaks, ...peaks])).slice(0, 8); } else ranges.push({ start, end, peaks }); }
            }
        }
        if (ranges.length === 0) return { samples: new Float32Array([]), regions: [] };
        const total = ranges.reduce((acc, r) => acc + (r.end - r.start), 0);
        const out = new Float32Array(total); let pos = 0;
        for (const r of ranges) for (let i = r.start; i < r.end; i++) out[pos++] = channel[i];
        return { samples: out, regions: ranges };
    };

    const processAndStore = async (blob: Blob) => {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const ac = new (window.AudioContext || (window as Window).webkitAudioContext)();
            const audioBuffer = await ac.decodeAudioData(arrayBuffer);
            let trimmedRes: { samples: Float32Array; regions: Region[] } = { samples: new Float32Array([]), regions: [] };
            if (trimEnabled) {
                trimmedRes = await trimNoise(audioBuffer);
            } else {
                const channel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : audioBuffer.getChannelData(0);
                const samples = channel.slice(0);
                // compute coarse peaks from first second (or whole buffer if shorter)
                const winN = Math.min(channel.length, Math.floor(audioBuffer.sampleRate * 1));
                const arr: { x: number; y: number }[] = [];
                for (let i = 0; i < winN; i++) arr.push({ x: i / audioBuffer.sampleRate, y: channel[i] });
                let peaks: number[] = [];
                try {
                    const fft = computeFFT(arr, audioBuffer.sampleRate);
                    peaks = fft.filter(f => f.frequency >= 50 && f.frequency <= 5000).sort((a, b) => b.amplitude - a.amplitude).slice(0, 5).map(p => p.frequency);
                } catch (e) { 
                    console.error('FFT compute error in processAndStore:', e); /* ignore */
                 }
                trimmedRes = { samples, regions: [{ start: 0, end: channel.length, peaks }] };
            }
            const trimmed = trimmedRes.samples;
            if (!trimmed || trimmed.length === 0) { alert("No signal detected."); try { ac.close(); } catch { } return; }
            const sampleRate = audioBuffer.sampleRate;
            const est = await estimatePitch(audioBuffer);
            const meta: SampleMetadata & { regions?: Region[] } = { dynamics, technique, string_id: stringId, fret, nominal_pitch_hz: nominalPitchHz ?? est, sample_rate: sampleRate, regions: trimmedRes.regions };
            const name = `${new Date().toISOString()}-${meta.technique}-${meta.dynamics}-${meta.string_id ?? "s"}${meta.fret ?? "f"}`;
            const wavBlob = float32ToWav(trimmed, sampleRate, embedMetadata ? meta : undefined);
            const metaBlob = new Blob([JSON.stringify({ ...meta, original_filename: `${name}-orig` }, null, 2)], { type: "application/json" });
            setLastCaptured({ name, meta, wavBlob, metaBlob });
            if (autoDownload) {
                try {
                    const wavUrl = URL.createObjectURL(wavBlob); const a = document.createElement("a"); a.href = wavUrl; a.download = `${name}.wav`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => { try { URL.revokeObjectURL(wavUrl); } catch { } }, 1500);
                    const metaUrl = URL.createObjectURL(metaBlob); const b = document.createElement("a"); b.href = metaUrl; b.download = `${name}.meta.json`; document.body.appendChild(b); b.click(); b.remove(); setTimeout(() => { try { URL.revokeObjectURL(metaUrl); } catch { } }, 1500);
                } catch (e) { console.warn("Auto-download failed or was blocked:", e); }
            }
            try { ac.close(); } catch { }
            if (onCaptured) onCaptured(name, meta, wavBlob, metaBlob);
        } catch (err) { console.error("Failed to process sample:", err); alert("Failed to process and save sample. See console for details."); }
    };

    const handleCapture = async () => {
        if (captureInProgress) return;
        try {
            setCaptureInProgress(true);
            //small delay to allow UI update
            await new Promise((res) => setTimeout(res, 200));
            const blob = await recordShort(captureDuration);
            await processAndStore(blob);
        } catch (err) { console.error("Capture failed:", err); alert("Capture failed. Ensure microphone permission is granted."); }
        finally { setCaptureInProgress(false); }
    };

    const handlePlay = () => {
        if (!lastCaptured?.wavBlob) return;
        const url = URL.createObjectURL(lastCaptured.wavBlob);
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = url;
        audioRef.current.onended = () => { try { URL.revokeObjectURL(url); } catch { } };
        audioRef.current.play();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        //verify file is wav and have metadata 
        if (file.type !== "audio/wav" && file.type !== "audio/wave" && file.type !== "audio/x-wav") {
            alert("Please select a WAV file.");
            return;
        }
        try {
            console.log("Loading sample from file:", file.name);
            // read file as array buffer
            const arrayBuffer = await file.arrayBuffer();
            // try to parse metadata before decoding - some decodeAudioData implementations can detach the source buffer
            let meta: SampleMetadata | null = null;
            try {
                meta = parseWavMeta(arrayBuffer);
            } catch (e) {
                console.warn('parseWavMeta failed initially, attempting copy fallback', e);
                try {
                    const copy = arrayBuffer.slice ? arrayBuffer.slice(0) : new Uint8Array(arrayBuffer).slice(0).buffer;
                    meta = parseWavMeta(copy);
                } catch (e2) {
                    console.warn('parseWavMeta copy fallback failed', e2);
                    meta = null;
                }
            }
            if (!meta) {
                alert("No metadata found in WAV file.");
                return;
            }

            console.log("Extracted metadata:", meta);
            // now decode for verification and to extract samples
            const ac = new (window.AudioContext || (window as Window).webkitAudioContext)();
            const audioBuffer = await ac.decodeAudioData(arrayBuffer);

            // build trimmedRes similar to processAndStore but avoid re-decoding later
            let trimmedRes: { samples: Float32Array; regions: Region[] } = { samples: new Float32Array([]), regions: [] };
            if (trimEnabled) {
                trimmedRes = await trimNoise(audioBuffer);
            } else {
                const channel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : audioBuffer.getChannelData(0);
                const samples = channel.slice(0);
                const winN = Math.min(channel.length, Math.floor(audioBuffer.sampleRate * 1));
                const arr: { x: number; y: number }[] = [];
                for (let i = 0; i < winN; i++) arr.push({ x: i / audioBuffer.sampleRate, y: channel[i] });
                let peaks: number[] = [];
                try {
                    const fft = computeFFT(arr, audioBuffer.sampleRate);
                    peaks = fft.filter(f => f.frequency >= 50 && f.frequency <= 5000).sort((a, b) => b.amplitude - a.amplitude).slice(0, 5).map(p => p.frequency);
                } catch (e) { console.error('FFT compute error in processAndStore:', e); /* ignore */ }
                trimmedRes = { samples, regions: [{ start: 0, end: channel.length, peaks }] };
            }
            const trimmed = trimmedRes.samples;
            if (!trimmed || trimmed.length === 0) { alert("No signal detected."); try { ac.close(); } catch { } return; }
            const sampleRate = audioBuffer.sampleRate;
            const est = await estimatePitch(audioBuffer);
            const loadedMeta: SampleMetadata & { regions?: Region[] } = { ...(meta as SampleMetadata), regions: trimmedRes.regions, sample_rate: sampleRate, nominal_pitch_hz: (meta as SampleMetadata)?.nominal_pitch_hz ?? est };
            const name = file.name.replace(/\.[^/.]+$/, "");
            const wavBlob = float32ToWav(trimmed, sampleRate, embedMetadata ? loadedMeta : undefined);
            const metaBlob = new Blob([JSON.stringify({ ...loadedMeta, original_filename: file.name }, null, 2)], { type: "application/json" });
            setLastCaptured({ name, meta: loadedMeta, wavBlob, metaBlob });
            // preload for playback
            try { if (!audioRef.current) audioRef.current = new Audio(); audioRef.current.src = URL.createObjectURL(wavBlob); } catch (e) { console.error('Failed to set audio source:', e); /* ignore */ }
            try { ac.close(); } catch { }
            if (onCaptured) onCaptured(name, loadedMeta, wavBlob, metaBlob);
            console.log('Loaded and stored sample from file.');

        } catch (err) {
            console.error("Failed to load sample from file:", err);
            alert("Failed to load sample from file. See console for details.");
        }
    }

    useEffect(() => {
        const nominal = guitarNotes[stringId ?? 6]?.find(n => n.fret === (fret ?? 0))?.frequency || '';
        setNominalPitchHz(typeof nominal === 'number' ? nominal : undefined);
    }, [stringId, fret]);

    return (
        <div className={styles.container}>
            <div className={styles.controls}>
                <select value={dynamics} onChange={(e) => setDynamics(e.target.value as DynamicValues)} className="input">
                    <option value="soft">Soft</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
                <select value={technique} onChange={(e) => setTechnique(e.target.value as TechniqueValues)} className="input">
                    <option value="finger">Finger</option>
                    <option value="pick">Pick</option>
                </select>
                <select value={stringId ?? ''} onChange={(e) => setStringId(e.target.value === '' ? undefined : Number(e.target.value))} className="input">
                    <option value="6">6 (Low E)</option>
                    <option value="5">5 (A)</option>
                    <option value="4">4 (D)</option>
                    <option value="3">3 (G)</option>
                    <option value="2">2 (B)</option>
                    <option value="1">1 (High E)</option>
                </select>
                <select value={fret ?? ''} onChange={(e) => setFret(e.target.value === '' ? undefined : Number(e.target.value))} className="input">
                    {[...Array(13).keys()].map((f) => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
                <label>
                    Nominal Pitch (Hz): {nominalPitchHz}
                </label>
                <input className="input" type="number" placeholder="duration ms" value={captureDuration} onChange={(e) => setCaptureDuration(Number(e.target.value))} />

                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={autoDownload} onChange={(e) => setAutoDownload(e.target.checked)} />
                    <span style={{ fontSize: 12 }}>Auto-download</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={embedMetadata} onChange={(e) => setEmbedMetadata(e.target.checked)} />
                    <span style={{ fontSize: 12 }}>Embed metadata in WAV</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={trimEnabled} onChange={(e) => setTrimEnabled(e.target.checked)} />
                    <span style={{ fontSize: 12 }}>Trim noise (STFT)</span>
                </label>
                <input
                    type="file"
                    onChange={handleFileChange}
                ></input>

                {captureInProgress ? (
                    <button className="btn" disabled>Capturing…</button>
                ) : lastCaptured ? (
                    <>
                        <button className="btn" onClick={() => {
                            try {
                                if (lastCaptured.wavBlob) {
                                    const url = URL.createObjectURL(lastCaptured.wavBlob);
                                    const a = document.createElement('a'); a.href = url; a.download = `${lastCaptured.name}.wav`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => { try { URL.revokeObjectURL(url); } catch { } }, 1500);
                                }
                                if (lastCaptured.metaBlob) {
                                    const url2 = URL.createObjectURL(lastCaptured.metaBlob);
                                    const b = document.createElement('a'); b.href = url2; b.download = `${lastCaptured.name}.meta.json`; document.body.appendChild(b); b.click(); b.remove(); setTimeout(() => { try { URL.revokeObjectURL(url2); } catch { } }, 1500);
                                }
                            } catch (e) { console.error('Download failed:', e); alert('Download failed. See console for details.'); }
                            setLastCaptured(null);
                        }}>Download</button>
                        <button className="btn" onClick={() => setLastCaptured(null)}>New Capture</button>
                        <button className="btn" onClick={handlePlay}>Play</button>
                    </>
                ) : (
                    <button className="btn" onClick={handleCapture}>{"Capture Sample"}</button>
                )}
            </div>

            <div className={styles.main}>
                {lastCaptured && (
                    <>
                        <DatasetCaptureCanvas captured={lastCaptured} nominalPitchHz={nominalPitchHz} />
                        <DatasetCaptureRegions captured={lastCaptured} />
                    </>
                )}

            </div>
        </div>
    );
}
