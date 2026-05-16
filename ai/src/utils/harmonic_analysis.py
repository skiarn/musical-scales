import numpy as np
from scipy import signal

def extract_harmonics(audio_signal, sample_rate, num_harmonics=5):
    """Extract fundamental frequency and harmonics from audio signal"""
    # Compute spectrogram
    frequencies, times, Sxx = signal.spectrogram(audio_signal, 
                                               fs=sample_rate,
                                               nperseg=2048,
                                               noverlap=1024)
    
    # Find peaks in frequency domain
    peak_frequencies = []
    for time_idx in range(Sxx.shape[1]):
        spectrum = Sxx[:, time_idx]
        peaks, _ = signal.find_peaks(spectrum, height=np.max(spectrum)/10)
        peak_freqs = frequencies[peaks]
        peak_frequencies.extend(peak_freqs)
    
    # Group frequencies into fundamental and harmonics
    fundamental = np.median(peak_frequencies)
    harmonics = [fundamental * (i + 1) for i in range(num_harmonics)]
    
    return fundamental, harmonics

def calculate_harmonic_ratios(signal_data, fundamental):
    """Calculate the strength of each harmonic relative to fundamental"""
    fft_data = np.fft.fft(signal_data)
    freqs = np.fft.fftfreq(len(signal_data))
    
    ratios = []
    for i in range(1, 6):  # First 5 harmonics
        harmonic_freq = fundamental * i
        idx = np.argmin(np.abs(freqs - harmonic_freq))
        ratios.append(np.abs(fft_data[idx]))
    
    # Normalize ratios
    ratios = np.array(ratios) / np.max(ratios)
    return ratios
