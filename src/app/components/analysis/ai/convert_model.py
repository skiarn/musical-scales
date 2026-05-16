import tensorflowjs as tfjs
import tensorflow as tf

def convert_model():
    # Load the saved model
    model = tf.saved_model.load('models/harmonics_autoencoder')
    
    # Convert and save as TensorFlow.js model
    tfjs.converters.save_keras_model(
        model,
        'public/models/harmonics_autoencoder'
    )

if __name__ == "__main__":
    convert_model()
