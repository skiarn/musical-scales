import numpy as np
import pandas as pd
from ..utils.harmonic_analysis import extract_harmonics, calculate_harmonic_ratios
from data.create_guitar_notes_csv import create_guitar_notes_data

def generate_synthetic_audio(frequency, duration=0.5, sample_rate=44100):
    """Generate synthetic audio signal with harmonics"""
    t = np.linspace(0, duration, int(sample_rate * duration))
    signal = np.zeros_like(t)
    
    # Add fundamental and harmonics with decreasing amplitude
    for i in range(1, 6):
        amplitude = 1.0 / i
        signal += amplitude * np.sin(2 * np.pi * frequency * i * t)
    
    # Add some noise
    noise = np.random.normal(0, 0.01, len(t))
    signal += noise
    
    return signal

def generate_harmonic_training_data(num_samples_per_note=10):
    guitar_notes = create_guitar_notes_data()
    training_data = []
    
    for _, note in guitar_notes.iterrows():
        for _ in range(num_samples_per_note):
            # Generate synthetic audio
            audio = generate_synthetic_audio(note['frequency'])
            
            # Extract features
            fundamental, harmonics = extract_harmonics(audio, 44100)
            harmonic_ratios = calculate_harmonic_ratios(audio, fundamental)
            
            # Store data
            training_data.append({
                'frequency': note['frequency'],
                'note': note['note'],
                'string': note['string'],
                'fret': note['fret'],
                'fundamental': fundamental,
                'harmonic_ratios': harmonic_ratios.tolist(),
                'harmonics': harmonics
            })
    
    return pd.DataFrame(training_data)

if __name__ == "__main__":
    df = generate_harmonic_training_data()
    df.to_csv('../data/harmonic_training_data.csv', index=False)
