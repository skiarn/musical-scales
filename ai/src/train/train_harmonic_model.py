import tensorflow as tf
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

def create_harmonic_model():
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(1024,)),  # FFT input size
        tf.keras.layers.Dense(512, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(256, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(6)  # Fundamental + 5 harmonic ratios
    ])
    
    model.compile(
        optimizer='adam',
        loss='mse',
        metrics=['mae']
    )
    
    return model

def train_model():
    # Load training data
    df = pd.read_csv('../data/harmonic_training_data.csv')
    
    # Prepare features and targets
    X = np.stack(df['harmonic_ratios'].apply(eval).values)
    y = np.column_stack([df['fundamental'], 
                        df['harmonics'].apply(eval).values.tolist()])
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    
    # Create and train model
    model = create_harmonic_model()
    model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_data=(X_test, y_test)
    )
    
    # Save model
    model.save('../models/harmonic_detector')
    print("Model saved to ../models/harmonic_detector")

if __name__ == "__main__":
    train_model()
