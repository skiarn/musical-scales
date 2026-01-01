
"use client";

import { useCallback, useEffect, useRef } from "react";
import { computeFFT } from "../../utils/fft";
import { Captured, Region } from "./DatasetCapture";
import styles from "./DatasetCaptureCanvas.module.css";

interface DatasetCaptureCanvasProps {
    nominalPitchHz?: number;
    captured: Captured | null;
}


export default function DatasetCaptureCanvas({ nominalPitchHz, captured }: DatasetCaptureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const canvasFFTRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const decodedRef = useRef<AudioBuffer | null>(null);

    const pinchRef = useRef<{ lastDist: number | null }>({ lastDist: null });

    const zoomRef = useRef({
        minHz: 50,
        maxHz: 5000,
    });

    const panRef = useRef<{
        active: boolean;
        lastX: number;
    }>({
        active: false,
        lastX: 0,
    });


    const freqToX = (f: number, minHz: number, maxHz: number, width: number) =>
        ((f - minHz) / (maxHz - minHz)) * width;

    const ampToY = (a: number, maxAmp: number, height: number) =>
        height - (a / maxAmp) * height;

    const drawFromBuffer = useCallback((ab: AudioBuffer, c: Captured) => {
        const data = ab.getChannelData(0);
        const canvasEl = canvasRef.current!;
        // resize canvas to container width
        const container = containerRef.current;
        const cw = Math.max(100, (container?.clientWidth ?? 600) - 0);
        canvasEl.width = cw;
        const h = container && container.clientWidth <= 600 ? 80 : 120;
        canvasEl.height = h;

        const ctx = canvasEl.getContext('2d'); if (!ctx) return;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const w = canvasEl.width; const hh = canvasEl.height;
        // downsample to canvas width
        const step = Math.max(1, Math.floor(data.length / w));
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh);
        ctx.lineWidth = 1; ctx.strokeStyle = '#333'; ctx.beginPath();
        for (let i = 0; i < w; i++) {
            const idx = i * step;
            const v = data[idx] || 0; const y = (1 - (v + 1) / 2) * hh;
            if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
        }
        ctx.stroke();

        // highlight regions
        const regions = c.meta?.regions || [];
        ctx.fillStyle = 'rgba(255,200,0,0.18)';
        regions.forEach((r: Region) => {
            const start = Math.floor((r.start / data.length) * w);
            const end = Math.ceil((r.end / data.length) * w);
            ctx.fillRect(start, 0, Math.max(1, end - start), hh);
        });
    }, [canvasRef, containerRef]);

    const drawFFTFromBuffer = useCallback((ab: AudioBuffer) => {
        const canvas = canvasFFTRef.current;
        if (!canvas) return;

        const container = containerRef.current;
        const width = Math.max(100, container?.clientWidth ?? 600);
        const height = 140;
        const padding = { left: 50, right: 10, top: 10, bottom: 30 };

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#0b0b0b";
        ctx.fillRect(0, 0, width, height);

        const data = ab.getChannelData(0);
        const sr = ab.sampleRate;

        const N = Math.min(data.length, Math.floor(sr * 0.5));
        const arr = Array.from({ length: N }, (_, i) => ({
            x: i / sr,
            y: data[i],
        }));

        let fft;
        try {
            fft = computeFFT(arr, sr);
        } catch {
            return;
        }

        const { minHz, maxHz } = zoomRef.current;
        const bins = fft.filter(f => f.frequency >= minHz && f.frequency <= maxHz);
        const maxAmp = Math.max(...bins.map(b => b.amplitude), 1e-6);

        const plotW = width - padding.left - padding.right;
        const plotH = height - padding.top - padding.bottom;

        /* ---------- AXES ---------- */

        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;

        // X axis
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.stroke();

        // Y axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.stroke();

        ctx.fillStyle = "#aaa";
        ctx.font = "10px monospace";

        // X ticks (Hz)
        const xTicks = 5;
        for (let i = 0; i <= xTicks; i++) {
            const f = minHz + (i / xTicks) * (maxHz - minHz);
            const x = padding.left + (i / xTicks) * plotW;
            ctx.fillText(`${Math.round(f)}Hz`, x - 14, height - 8);
            ctx.strokeStyle = "#222";
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();
        }

        // Y ticks (amplitude)
        const yTicks = 4;
        for (let i = 0; i <= yTicks; i++) {
            const y = padding.top + (i / yTicks) * plotH;
            const amp = ((yTicks - i) / yTicks).toFixed(2);
            ctx.fillText(amp, 4, y + 3);
            ctx.strokeStyle = "#222";
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        /* ---------- SPECTRUM ---------- */

        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 1.2;
        ctx.beginPath();

        bins.forEach((b, i) => {
            const x =
                padding.left +
                freqToX(b.frequency, minHz, maxHz, plotW);
            const y =
                padding.top +
                ampToY(b.amplitude, maxAmp, plotH);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        /* ---------- MARKERS ---------- */

        // nominal pitch
        if (nominalPitchHz && nominalPitchHz >= minHz && nominalPitchHz <= maxHz) {
            const x =
                padding.left +
                freqToX(nominalPitchHz, minHz, maxHz, plotW);
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, height - padding.bottom);
            ctx.stroke();
        }

        // region peaks
        ctx.fillStyle = "#facc15";
        const peaks = captured?.meta?.regions?.[0]?.peaks ?? [];
        peaks.forEach((p: number) => {
            if (p < minHz || p > maxHz) return;
            const x = padding.left + freqToX(p, minHz, maxHz, plotW);
            ctx.fillRect(x - 1, height - padding.bottom - 10, 2, 10);
        });
    }, [canvasFFTRef, nominalPitchHz, captured]);


    useEffect(() => {
        const canvas = canvasFFTRef.current;
        if (!canvas) return;

        const getX = (e: MouseEvent | TouchEvent) =>
            "touches" in e ? e.touches[0].clientX : e.clientX;

        const onDown = (e: MouseEvent | TouchEvent) => {
            panRef.current.active = true;
            panRef.current.lastX = getX(e);
        };

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!panRef.current.active) return;

            const x = getX(e);
            const dx = x - panRef.current.lastX;
            panRef.current.lastX = x;

            const zoom = zoomRef.current;
            const range = zoom.maxHz - zoom.minHz;

            // pixels → Hz (drag sensitivity)
            const container = containerRef.current;
            const width = Math.max(100, container?.clientWidth ?? 600);
            const hzPerPixel = range / width;

            const shift = -dx * hzPerPixel;

            zoom.minHz += shift;
            zoom.maxHz += shift;

            // clamp bounds
            const minLimit = 20;
            const maxLimit = 10000;

            if (zoom.minHz < minLimit) {
                zoom.maxHz += minLimit - zoom.minHz;
                zoom.minHz = minLimit;
            }
            if (zoom.maxHz > maxLimit) {
                zoom.minHz -= zoom.maxHz - maxLimit;
                zoom.maxHz = maxLimit;
            }

            if (decodedRef.current) {
                drawFFTFromBuffer(decodedRef.current);
            }
        };

        const onUp = () => {
            panRef.current.active = false;
        };

        const onWheel = (e: WheelEvent) => {
            // VERY IMPORTANT: stop scroll container
            e.preventDefault();
            e.stopPropagation();

            const zoom = zoomRef.current;
            const center = (zoom.minHz + zoom.maxHz) / 2;
            const range = zoom.maxHz - zoom.minHz;

            // trackpad + mouse friendly
            const zoomFactor = Math.exp(e.deltaY * 0.001);

            let newRange = range * zoomFactor;
            newRange = Math.max(100, Math.min(8000, newRange));

            zoom.minHz = Math.max(20, center - newRange / 2);
            zoom.maxHz = Math.min(10000, center + newRange / 2);

            if (decodedRef.current) {
                drawFFTFromBuffer(decodedRef.current);
            }
        };

        const getDistance = (t1: Touch, t2: Touch) =>
            Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 2) {
                pinchRef.current.lastDist = null;
                return;
            }

            e.preventDefault(); // important: prevent page scroll while zooming

            const dist = getDistance(e.touches[0], e.touches[1]);
            const last = pinchRef.current.lastDist;
            pinchRef.current.lastDist = dist;

            if (!last) return; // first move, just store distance

            const zoom = zoomRef.current;
            const center = (zoom.minHz + zoom.maxHz) / 2;
            const range = zoom.maxHz - zoom.minHz;

            // zoom factor: pinch out = smaller delta = zoom in
            const zoomFactor = last / dist;
            let newRange = range * zoomFactor;

            // clamp
            newRange = Math.max(100, Math.min(8000, newRange));

            zoom.minHz = Math.max(20, center - newRange / 2);
            zoom.maxHz = Math.min(10000, center + newRange / 2);

            // redraw
            if (decodedRef.current) drawFFTFromBuffer(decodedRef.current);
        };

        canvas.addEventListener("wheel", onWheel, { passive: false });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        // mouse
        canvas.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        // touch
        canvas.addEventListener("touchstart", onDown, { passive: true });
        canvas.addEventListener("touchmove", onMove, { passive: false });
        canvas.addEventListener("touchend", onUp);

        return () => {
            canvas.removeEventListener("mousedown", onDown);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            canvas.removeEventListener("touchstart", onDown);
            canvas.removeEventListener("touchmove", onMove);
            canvas.removeEventListener("touchend", onUp);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("touchmove", onTouchMove);
        };
    }, [drawFromBuffer, drawFFTFromBuffer]);



    useEffect(() => {
        // Draw waveform when lastCaptured changes (decode once, then reuse on resize)
        if (!captured || !captured.wavBlob) return;
        let cancelled = false;
        const canvas = canvasRef.current;
        if (!canvas) return;




        (async () => {
            try {
                const arrayBuffer = await captured.wavBlob!.arrayBuffer();
                const ac = new (window.AudioContext || (window as Window).webkitAudioContext)();
                const ab = await ac.decodeAudioData(arrayBuffer);
                decodedRef.current = ab;
                if (!cancelled) drawFromBuffer(ab, captured);
                if (!cancelled) drawFFTFromBuffer(ab);
                try { ac.close(); } catch { }
            } catch (e) {
                console.warn('Waveform draw failed:', e);
            }
        })();

        const handleResize = () => {
            if (decodedRef.current) {
                drawFromBuffer(decodedRef.current, captured);
                drawFFTFromBuffer(decodedRef.current);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => { cancelled = true; window.removeEventListener('resize', handleResize); };
    }, [captured, drawFromBuffer, drawFFTFromBuffer]);

    return (<>
        {captured && (<div className={styles.canvasWrapper}>
            <canvas ref={canvasRef} className={styles.canvas} />
            <canvas ref={canvasFFTRef} className={styles.canvas} />
        </div>
        )}
    </>)
}