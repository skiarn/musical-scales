import pandas as pd
import numpy as np
import librosa
from sklearn.preprocessing import StandardScaler
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras import layers, models

# --- Step 1: Load Harmonic CSV ---
csv = pd.read_csv("../data/harmonic_training_data.csv")

# --- Step 2: Extract Audio Features ---
def extract_features(file_path, sr=22050, duration=3.0):
    y, _ = librosa.load(file_path, sr=sr, duration=duration)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    return np.mean(mfcc.T, axis=0)

# --- Step 3: Build Feature Set ---
X = [extract_features(row['file']) for _, row in csv.iterrows()]
X = np.array(X)

# --- Step 4: Normalize Features ---
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# --- Step 5: Prepare Harmonic Labels ---
harmonic_cols = ["H1", "H2", "H3", "H4", "H5"]
y = csv[harmonic_cols].fillna(0).values

# Binary classification target: detect harmonic presence
y_binary = (y.sum(axis=1) > 0).astype(int)

# --- Step 6: Create Autoencoder ---
input_dim = X.shape[1]
input_layer = layers.InputLayer(input_shape=(input_dim,))
inputs = layers.Input(shape=(input_dim,))
encoded = layers.Dense(8, activation='relu')(inputs)
encoded = layers.Dense(4, activation='relu')(encoded)
decoded = layers.Dense(8, activation='relu')(encoded)
recon_output = layers.Dense(input_dim, activation='linear')(decoded)
autoencoder = models.Model(inputs=inputs, outputs=recon_output)
autoencoder.compile(optimizer='adam', loss='mse')
autoencoder.fit(X_scaled, X_scaled, epochs=50, batch_size=8, validation_split=0.2)

# --- Step 7: Compress Audio Features ---
encoder = models.Model(inputs=inputs, outputs=encoded)
compressed_features = encoder.predict(X_scaled)
np.save("compressed_features.npy", compressed_features)

# --- Step 8: Visualize Latent Space ---
tsne = TSNE(n_components=2, perplexity=30, random_state=42)
X_tsne = tsne.fit_transform(compressed_features)

plt.figure(figsize=(8, 6))
plt.scatter(X_tsne[:, 0], X_tsne[:, 1], c=y_binary, cmap='coolwarm', s=30)
plt.colorbar(label='Harmonic Presence')
plt.title("t-SNE of Compressed Harmonic Features")
plt.xlabel("t-SNE Dim 1")
plt.ylabel("t-SNE Dim 2")
plt.show()

# --- Step 9: Train Keras Classifier ---
clf_input_layer = layers.InputLayer(input_shape=(compressed_features.shape[1],))
clf_inputs = layers.Input(shape=(compressed_features.shape[1],))
x = layers.Dense(16, activation='relu')(clf_inputs)
x = layers.Dense(8, activation='relu')(x)
clf_output = layers.Dense(1, activation='sigmoid')(x)
classifier = models.Model(clf_inputs, clf_output)
classifier.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
X_train, X_test, y_train, y_test = train_test_split(compressed_features, y_binary,
                                                    test_size=0.2, random_state=42)
classifier.fit(X_train, y_train, epochs=50, batch_size=8, validation_split=0.2)

# --- Step 10: Save Classifier for TensorFlow.js ---
classifier.save('harmonic_autoencoder.h5') # Use this file for TensorFlow.js conversion
## Convert with TensorFlow.js CLI (run in terminal):
# pip install tensorflowjs
# tensorflowjs_converter --input_format=keras harmonic_autoencoder.h5 tfjs_model/
