import numpy as np
import matplotlib.pyplot as plt
import soundfile as sf  # You can also use scipy.io.wavfile

# Parameters
duration = 2.0  # seconds
sampling_rate = 44100  # Hz
frequencies = [440, 880, 1760]  # Peaks at A4, A5, A6
amplitudes = [1.0, 0.6, 0.3]  # Relative amplitude per frequency
noise_level = 0.2  # Scale of random noise

# Time array
t = np.linspace(0, duration, int(sampling_rate * duration), endpoint=False)

# Generate signal with multiple sine waves
signal = sum(amp * np.sin(2 * np.pi * freq * t) for freq, amp in zip(frequencies, amplitudes))

# Add white noise
noise = noise_level * np.random.normal(size=t.shape)
signal_with_noise = signal + noise

# Normalize to avoid clipping
signal_with_noise /= np.max(np.abs(signal_with_noise))

# Save as WAV file
sf.write("signal_with_noise.wav", signal_with_noise, sampling_rate)

# Plot
plt.plot(t[:1000], signal_with_noise[:1000])  # Just a short snippet
plt.title("Audio Signal with Peaks and Noise")
plt.xlabel("Time [s]")
plt.ylabel("Amplitude")
plt.show()
