import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
import glob
import os
import scipy.signal
import pandas as pd

# Harmonic detection function
def detect_harmonics(fundamental, peak_freqs, peak_mags, tolerance=5):
    harmonics = []
    for i in range(1, 6):  # Include the fundamental as 1×
        expected = fundamental * i
        close_match = [
            (freq, mag) for freq, mag in zip(peak_freqs, peak_mags)
            if abs(freq - expected) < tolerance
        ]
        if close_match:
            freq, mag = close_match[0]
            harmonics.append({'Order': f'{i}×', 'Frequency (Hz)': round(freq, 1), 'Magnitude': round(mag, 2)})
    return harmonics

def is_harmonic_of(test_freq, base_freq, tolerance=5):
    ratio = test_freq / base_freq
    nearest_int = round(ratio)
    return abs(test_freq - base_freq * nearest_int) < tolerance and nearest_int > 1

def filter_true_fundamentals(freqs, mags, tolerance=5):
    fundamentals = []
    for i, f in enumerate(freqs):
        is_harmonic = False
        for base in fundamentals:
            if is_harmonic_of(f, base['freq'], tolerance):
                is_harmonic = True
                break
        if not is_harmonic:
            fundamentals.append({'freq': f, 'mag': mags[i]})
    return fundamentals

def prefilter_harmonics(freqs, tolerance=5):
    clean_freqs = []
    for i, f in enumerate(freqs):
        is_harmonic = False
        for base in clean_freqs:
            ratio = f / base
            nearest_int = round(ratio)
            if nearest_int <= 1:
                continue
            if abs(f - base * nearest_int) < tolerance:
                is_harmonic = True
                break
        if not is_harmonic:
            clean_freqs.append(f)
    return clean_freqs

def filter_close_peaks(freqs, mags, min_spacing=2.0):
    selected = []
    for i, f in enumerate(freqs):
        if all(abs(f - s['freq']) >= min_spacing for s in selected):
            selected.append({'freq': f, 'mag': mags[i]})
    return selected

def score_fundamental(fundamental, peak_freqs, tolerance=5, max_order=6):
    score = 0
    harmonics = []
    for i in range(1, max_order + 1):
        expected = fundamental * i
        match = [f for f in peak_freqs if abs(f - expected) < tolerance]
        if match:
            score += 1
            harmonics.append(round(match[0], 1))
    return score, harmonics

def infer_compound_fundamentals(peak_freqs, tolerance=5, max_harmonic=5):
    compound_candidates = {}
    for f in peak_freqs:
        for n in range(2, max_harmonic + 1):
            candidate_fundamental = f / n
            harmonics = [
                round(candidate_fundamental * i, 1)
                for i in range(1, max_harmonic + 1)
            ]
            matched = [h for h in harmonics if any(abs(h - pf) < tolerance for pf in peak_freqs)]
            if len(matched) >= 3:  # threshold of richness
                cf = round(candidate_fundamental, 2)
                compound_candidates[cf] = matched
    return compound_candidates

# Path to your audio files
audio_folder = "data/guitar/"
file_paths = glob.glob(os.path.join(audio_folder, "*.wav"))

data = []

for file in file_paths:
    print(f"\nProcessing {file}")
    
    # Load audio file
    y, sr = librosa.load(file, sr=None)
    
    # Time axis
    t = np.linspace(0, len(y) / sr, len(y))
    
    # Plot waveform
    plt.figure(figsize=(12, 4))
    plt.plot(t, y)
    plt.title(f"Waveform: {os.path.basename(file)}")
    plt.xlabel("Time [s]")
    plt.ylabel("Amplitude")
    plt.grid(True)
    plt.tight_layout()
    plt.show()
    
    # FFT
    fft_result = np.fft.fft(y)
    fft_freqs = np.fft.fftfreq(len(fft_result), 1 / sr)

    positive_freqs = fft_freqs[:len(fft_freqs)//2]
    positive_magnitudes = np.abs(fft_result[:len(fft_result)//2])

    plt.figure(figsize=(12, 4))
    plt.plot(positive_freqs, positive_magnitudes)
    plt.title(f"FFT: {os.path.basename(file)}")
    plt.xlabel("Frequency [Hz]")
    plt.ylabel("Magnitude")
    plt.grid(True)
    plt.tight_layout()
    plt.xlim(0, 5000)
    plt.show()

    # Find and sort peaks by magnitude
    peaks, _ = scipy.signal.find_peaks(positive_magnitudes, prominence=np.max(positive_magnitudes)*0.1)
    peak_freqs = positive_freqs[peaks]
    peak_mags = positive_magnitudes[peaks]

    sorted_indices = np.argsort(peak_mags)[::-1]  # descending order
    sorted_freqs = peak_freqs[sorted_indices]
    sorted_mags = peak_mags[sorted_indices]

    # Loop through top N peaks
    top_n = min(10, len(sorted_freqs))
    top_freqs = sorted_freqs[:top_n]
    top_mags = sorted_mags[:top_n]
    
    # Apply spacing filter before harmonic filtering
    spaced_peaks = filter_close_peaks(top_freqs, top_mags, min_spacing=2.0)
    filtered_freqs = prefilter_harmonics([p['freq'] for p in spaced_peaks])
    
    # Score each candidate and filter based on harmonic richness
    true_fundamentals = []
    for f in filtered_freqs:
        score, harmonics = score_fundamental(f, sorted_freqs)
        if score >= 1:  # Change threshold to tune strictness
            true_fundamentals.append({
                'freq': f,
                'mag': sorted_mags[np.where(sorted_freqs == f)[0][0]],
                'score': score,
                'harmonics': harmonics
            })
    
    # Display detailed results
    for f in true_fundamentals:
        print(f"\n🔎 Testing Fundamental: {f['freq']:.1f} Hz — Magnitude: {f['mag']:.2f} — Harmonic Matches: {f['score']}")
        print("🧮 Harmonic Frequencies:", ", ".join(map(str, f['harmonics'])))
        harmonic_data = detect_harmonics(f['freq'], sorted_freqs, sorted_mags)
        df = pd.DataFrame(harmonic_data)
        print("📊 Harmonic Table:")
        print(df.to_string(index=False))

    compound_fundamentals = infer_compound_fundamentals(sorted_freqs)
    for cf, matches in compound_fundamentals.items():
        print(f"\n🎯 Inferred Fundamental: {cf} Hz — Matches:", ", ".join(map(str, matches)))


    for entry in true_fundamentals:
        row = {
            'file': file,
            'FundamentalFreq': entry['freq'],
            'Magnitude': entry['mag'],
            'HarmonicMatches': entry['score']
        }
        # Flatten harmonics list into individual columns (H1, H2, ...)
        for i, h in enumerate(entry['harmonics']):
            row[f'H{i+1}'] = h
        data.append(row)
    
 
df = pd.DataFrame(data)
df.to_csv('harmonic_training_data.csv', index=False)