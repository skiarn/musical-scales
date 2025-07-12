import numpy as np
import pandas as pd
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from data.create_guitar_notes_csv import create_guitar_notes_data

def generate_frequency_variations(frequency, num_variations=10, noise_factor=0.02):
    """Generate variations around a base frequency with some noise"""
    variations = []
    for _ in range(num_variations):
        noise = np.random.normal(0, noise_factor * frequency)
        variations.append(frequency + noise)
    return variations

def generate_training_data():
    all_data = []
    guitar_notes_df = create_guitar_notes_data()
    
    for _, note_data in guitar_notes_df.iterrows():
        # Generate variations for each note
        variations = generate_frequency_variations(note_data['frequency'])
        for freq in variations:
            all_data.append({
                'input_frequency': freq,
                'true_frequency': note_data['frequency'],
                'note': note_data['note'],
                'string': note_data['string'],
                'fret': note_data['fret']
            })
    
    return pd.DataFrame(all_data)

if __name__ == "__main__":
    # Generate and save training data
    df = generate_training_data()
    
    # Create output directory if it doesn't exist
    output_dir = os.path.join(os.path.dirname(__file__), '../data')
    os.makedirs(output_dir, exist_ok=True)
    
    # Save to CSV
    output_path = os.path.join(output_dir, 'guitar_frequencies.csv')
    df.to_csv(output_path, index=False)
    print(f"Training data saved to {output_path}")
