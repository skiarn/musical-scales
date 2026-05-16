"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface WaveExperimentalInputProps {
    onDataCaptured: (data: Float32Array<ArrayBufferLike>, sampleRate: number) => void;
}

const WaveExperimentalInput: React.FC<WaveExperimentalInputProps> = ({ onDataCaptured }) => {
    const [experimentalInputEnabled, setExperimentalInputEnabled] = useState(false);
    const [experimentalInputMode, setExperimentalInputMode] = useState<"mic" | "motion">("mic");
    const [isRecordingMicInput, setIsRecordingMicInput] = useState(false);
    const [isCapturingMotionInput, setIsCapturingMotionInput] = useState(false);
    const [motionCaptureStatus, setMotionCaptureStatus] = useState("Idle");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const motionListenerRef = useRef<((event: DeviceMotionEvent) => void) | null>(null);
    const motionSamplesRef = useRef<number[]>([]);
    const motionLastSampleTsRef = useRef(0);
    const motionBaselineRef = useRef(0);

    const stopMicInputCapture = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setIsRecordingMicInput(false);
    }, []);

    const startMicInputCapture = useCallback(async () => {
        if (isRecordingMicInput) return;
        try {
            audioChunksRef.current = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(audioChunksRef.current);
                    if (audioBlob.size === 0) return;
                    const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    onDataCaptured(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
                    if (audioCtx.close) await audioCtx.close();
                } catch (error) {
                    console.error("Failed to decode microphone recording", error);
                } finally {
                    audioChunksRef.current = [];
                    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
                    mediaStreamRef.current = null;
                    setIsRecordingMicInput(false);
                }
            };

            recorder.start();
            setIsRecordingMicInput(true);
        } catch (error) {
            console.error("Microphone capture failed", error);
            setIsRecordingMicInput(false);
        }
    }, [isRecordingMicInput, onDataCaptured]);

    const stopMotionInputCapture = useCallback(() => {
        if (motionListenerRef.current) {
            window.removeEventListener("devicemotion", motionListenerRef.current as EventListener);
            motionListenerRef.current = null;
        }

        setIsCapturingMotionInput(false);

        const samples = motionSamplesRef.current;
        if (samples.length < 16) {
            setMotionCaptureStatus("Motion capture stopped (not enough samples)");
            return;
        }

        const targetSampleRate = 60;
        onDataCaptured(new Float32Array(samples), targetSampleRate);
        setMotionCaptureStatus(`Captured ${samples.length} motion samples at ${targetSampleRate} Hz`);
    }, [onDataCaptured]);

    const startMotionInputCapture = useCallback(async () => {
        if (isCapturingMotionInput) return;
        if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
            setMotionCaptureStatus("DeviceMotion API not available in this browser/device");
            return;
        }

        try {
            const requestPermission = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
            if (typeof requestPermission === "function") {
                const permissionState = await requestPermission();
                if (permissionState !== "granted") {
                    setMotionCaptureStatus("Motion permission denied");
                    return;
                }
            }
        } catch (error) {
            console.error("Motion permission request failed", error);
            setMotionCaptureStatus("Could not request motion permission");
            return;
        }

        motionSamplesRef.current = [];
        motionLastSampleTsRef.current = 0;
        motionBaselineRef.current = 0;
        const targetSampleRate = 60;
        const minDeltaMs = 1000 / targetSampleRate;

        const handleMotion = (event: DeviceMotionEvent) => {
            const now = performance.now();
            if (now - motionLastSampleTsRef.current < minDeltaMs) return;
            motionLastSampleTsRef.current = now;

            const acc = event.acceleration;
            const accWithGravity = event.accelerationIncludingGravity;
            const axisValue = acc?.x ?? accWithGravity?.x ?? 0;

            motionBaselineRef.current = motionBaselineRef.current * 0.98 + axisValue * 0.02;
            const highPass = axisValue - motionBaselineRef.current;
            const normalized = Math.max(-1, Math.min(1, highPass / 12));

            motionSamplesRef.current.push(normalized);
        };

        motionListenerRef.current = handleMotion;
        window.addEventListener("devicemotion", handleMotion as EventListener);
        setIsCapturingMotionInput(true);
        setMotionCaptureStatus("Capturing motion data...");
    }, [isCapturingMotionInput]);

    useEffect(() => {
        if (experimentalInputEnabled) return;
        stopMicInputCapture();
        if (isCapturingMotionInput) stopMotionInputCapture();
    }, [experimentalInputEnabled, isCapturingMotionInput, stopMicInputCapture, stopMotionInputCapture]);

    useEffect(() => {
        return () => {
            stopMicInputCapture();
            if (motionListenerRef.current) {
                window.removeEventListener("devicemotion", motionListenerRef.current as EventListener);
                motionListenerRef.current = null;
            }
        };
    }, [stopMicInputCapture]);

    return (
        <div
            style={{
                margin: "0.6rem 0 1rem",
                padding: "0.7rem",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <input
                        type="checkbox"
                        checked={experimentalInputEnabled}
                        onChange={(e) => setExperimentalInputEnabled(e.target.checked)}
                    />
                    Experimental Input Mode
                </label>

                {experimentalInputEnabled && (
                    <>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            Source
                            <select
                                value={experimentalInputMode}
                                onChange={(e) => setExperimentalInputMode(e.target.value as "mic" | "motion")}
                                style={{ minWidth: "130px" }}
                            >
                                <option value="mic">Microphone</option>
                                <option value="motion">Device Motion</option>
                            </select>
                        </label>

                        {experimentalInputMode === "mic" ? (
                            <button
                                type="button"
                                onClick={isRecordingMicInput ? stopMicInputCapture : startMicInputCapture}
                                style={{
                                    padding: "0.3rem 0.8rem",
                                    borderRadius: "4px",
                                    border: "1px solid #555",
                                    background: isRecordingMicInput ? "#c0392b" : "#16a085",
                                    color: "#fff",
                                    cursor: "pointer"
                                }}
                            >
                                {isRecordingMicInput ? "Stop Mic Capture" : "Start Mic Capture"}
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={isCapturingMotionInput ? stopMotionInputCapture : startMotionInputCapture}
                                    style={{
                                        padding: "0.3rem 0.8rem",
                                        borderRadius: "4px",
                                        border: "1px solid #555",
                                        background: isCapturingMotionInput ? "#c0392b" : "#2c7fb8",
                                        color: "#fff",
                                        cursor: "pointer"
                                    }}
                                >
                                    {isCapturingMotionInput ? "Stop Motion Capture" : "Start Motion Capture"}
                                </button>
                                <small style={{ opacity: 0.85 }}>{motionCaptureStatus}</small>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default WaveExperimentalInput;
