import tensorflow as tf
import pandas as pd
import numpy as np
import os
import json
import librosa

# Set random seed for reproducibility
tf.random.set_seed(42)
np.random.seed(42)

class HarmonicsAutoencoder:
    def __init__(self):
        self.input_size = 1024
        self.encoding_dim = 16
        self.model = None
    
    def build_model(self):
        # Encoder
        inputs = tf.keras.Input(shape=(self.input_size,))
        x = tf.keras.layers.Dense(512, activation='relu')(inputs)
        x = tf.keras.layers.Dense(256, activation='relu')(x)
        x = tf.keras.layers.Dense(128, activation='relu')(x)
        
        # Bottleneck
        latent = tf.keras.layers.Dense(self.encoding_dim, activation='relu')(x)
        
        # Harmonics analyzer branch
        fundamental_freq = tf.keras.layers.Dense(1, activation='sigmoid', name='fundamental')(latent)
        harmonics = tf.keras.layers.Dense(8, activation='sigmoid', name='harmonics')(latent)
        
        # Decoder
        x = tf.keras.layers.Dense(128, activation='relu')(latent)
        x = tf.keras.layers.Dense(256, activation='relu')(x)
        x = tf.keras.layers.Dense(512, activation='relu')(x)
        outputs = tf.keras.layers.Dense(self.input_size, activation='tanh')(x)
        
        self.model = tf.keras.Model(inputs, [outputs, fundamental_freq, harmonics])
        
        self.model.compile(
            optimizer='adam',
            loss={
                'fundamental': 'mse',
                'harmonics': 'mse',
                'dense_4': 'mse'  # reconstruction loss
            },
            loss_weights={
                'fundamental': 1.0,
                'harmonics': 0.5,
                'dense_4': 0.3
            }
        )
    
    def prepare_training_data(self, audio_files):
        X = []
        y_fund = []
        y_harm = []
        
        for file in audio_files:
            y, sr = librosa.load(file)
            segments = librosa.util.frame(y, frame_length=self.input_size, hop_length=self.input_size//2)
            
            for segment in segments.T:
                # Normalize segment
                segment = segment / np.max(np.abs(segment))
                
                # Get fundamental frequency and harmonics
                f0, harmonic_rates = librosa.piptrack(y=segment, sr=sr)
                fund_freq = np.mean(f0[f0 > 0]) if len(f0[f0 > 0]) > 0 else 0
                harmonics = np.abs(librosa.stft(segment))[:8]
                harmonics = harmonics / np.max(harmonics)
                
                X.append(segment)
                y_fund.append(fund_freq / 1000.0)  # normalize to 0-1 range
                y_harm.append(harmonics)
        
        return np.array(X), np.array(y_fund), np.array(y_harm)

def main():
    # Training data path
    audio_files = ['path/to/your/audio/files/*.wav']
    
    # Create and train model
    autoencoder = HarmonicsAutoencoder()
    autoencoder.build_model()
    
    # Prepare training data
    X, y_fund, y_harm = autoencoder.prepare_training_data(audio_files)
    
    # Train the model
    history = autoencoder.model.fit(
        X,
        {
            'fundamental': y_fund,
            'harmonics': y_harm,
            'dense_4': X
        },
        epochs=100,
        batch_size=32,
        validation_split=0.2
    )
    
    # Save the model
    tf.saved_model.save(autoencoder.model, 'models/harmonics_autoencoder')

if __name__ == "__main__":
    main()
