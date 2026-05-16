"use client";

import React, { useEffect } from "react";
import { applyFrequencyFilter } from "../../utils/fft";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaveFilterType = "none" | "lowpass" | "highpass";

interface WaveformFilterProps {
    /** Raw (unfiltered) time-domain waveform as {x, y}[] */
    data: { x: number; y: number }[];
    /** Sample rate of the signal in Hz */
    sampleRate: number;
    /** Controlled filter type — lifted to the parent to survive tab switches. */
    filterType: WaveFilterType;
    /** Controlled cutoff frequency in Hz — lifted to the parent to survive tab switches. */
    cutoffHz: number;
    /** Called when the user changes the filter type. */
    onFilterTypeChange: (type: WaveFilterType) => void;
    /** Called when the user moves the cutoff slider. */
    onCutoffChange: (hz: number) => void;
    /**
     * Called whenever the filter settings change.
     * Receives the filtered waveform (or the original data when `type === "none"`).
     * This is a display-only operation — the original `data` array is never mutated.
     */
    onFilteredData: (filtered: { x: number; y: number }[]) => void;
}

// ---------------------------------------------------------------------------
// WaveformFilter
// ---------------------------------------------------------------------------

/**
 * WaveformFilter
 *
 * A UI control that applies a real-time low-pass or high-pass filter to a
 * time-domain waveform and forwards the result via `onFilteredData`.
 *
 * ## Filter types
 *
 * | Mode      | What it removes          | Typical use                         |
 * |-----------|--------------------------|-------------------------------------|
 * | Low-pass  | Frequencies above f_c    | Remove hiss, noise, high harmonics  |
 * | High-pass | Frequencies below f_c    | Remove hum, DC offset, rumble       |
 *
 * ## Implementation
 *
 * Filtering is performed entirely in the frequency domain using FFT → gain → IFFT:
 *
 *   1. The input signal is zero-padded to the next power of 2 and its FFT is computed.
 *   2. A per-bin **sigmoid gain** is multiplied into the complex spectrum:
 *
 *        Low-pass:   G[k] = 1 / (1 + exp( α · (f_k − f_c)))
 *        High-pass:  G[k] = 1 / (1 + exp(−α · (f_k − f_c)))
 *
 *      where f_k = k · f_s / N  and  α = 20 / f_c.
 *
 *      The sigmoid rolloff avoids the sharp Gibbs ringing that a hard brick-wall
 *      cutoff would introduce in the reconstructed time-domain signal.
 *
 *   3. The modified spectrum is transformed back with an IFFT to yield the
 *      filtered waveform, which is then trimmed to the original signal length.
 *
 * The operation is purely for display — `data` is never mutated.
 */
const WaveformFilter: React.FC<WaveformFilterProps> = ({
    data,
    sampleRate,
    filterType,
    cutoffHz,
    onFilterTypeChange,
    onCutoffChange,
    onFilteredData,
}) => {
    const nyquist = sampleRate / 2;

    // Re-apply filter whenever any dependency changes
    useEffect(() => {
        if (filterType === "none" || data.length === 0) {
            onFilteredData(data);
            return;
        }
        const filtered = applyFrequencyFilter(data, sampleRate, filterType, cutoffHz);
        onFilteredData(filtered);
        // onFilteredData intentionally omitted — it would cause infinite re-renders
        // if the parent re-creates the callback on every render without useCallback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, sampleRate, filterType, cutoffHz]);

    const buttonStyle = (active: boolean): React.CSSProperties => ({
        padding: "0.25rem 0.75rem",
        borderRadius: "4px",
        border: "1px solid #555",
        background: active ? "#4a90d9" : "transparent",
        color: active ? "#fff" : "inherit",
        cursor: "pointer",
        fontSize: "0.85rem",
    });

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.5rem 0",
                flexWrap: "wrap",
            }}
        >
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Waveform Filter:</span>

            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button style={buttonStyle(filterType === "none")} onClick={() => onFilterTypeChange("none")}>
                    None
                </button>
                <button style={buttonStyle(filterType === "lowpass")} onClick={() => onFilterTypeChange("lowpass")}>
                    Low-pass
                </button>
                <button style={buttonStyle(filterType === "highpass")} onClick={() => onFilterTypeChange("highpass")}>
                    High-pass
                </button>
            </div>

            {filterType !== "none" && (
                <label
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}
                >
                    Cutoff:
                    <input
                        type="range"
                        min={20}
                        max={nyquist}
                        step={10}
                        value={cutoffHz}
                        onChange={(e) => onCutoffChange(Number(e.target.value))}
                        style={{ width: "180px" }}
                    />
                    <span style={{ minWidth: "64px" }}>{cutoffHz.toLocaleString()} Hz</span>
                </label>
            )}
        </div>
    );
};

export default WaveformFilter;
