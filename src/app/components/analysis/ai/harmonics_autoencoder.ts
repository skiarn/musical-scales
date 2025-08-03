import * as tf from '@tensorflow/tfjs';

export interface HarmonicsData {
  fundamentalFreq: number;
  harmonicAmplitudes: number[];
}

export class HarmonicsAutoencoder {
  private model: tf.LayersModel | null = null;
  private readonly inputSize: number = 1024;
  
  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    try {
      const url = `${process.env.basePath}/models/harmonics_autoencoder/model.json`;
      this.model = await tf.loadLayersModel(url);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  }

  public async encode(waveform: number[]): Promise<HarmonicsData> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Prepare input
    const input = tf.tensor2d([waveform], [1, this.inputSize]);
    
    // Get predictions
    const output = this.model.predict(input) as tf.Tensor;
    const outputData = Array.from(await output.data());
    // outputData: [fundamental, harmonic1, harmonic2, harmonic3, harmonic4, harmonic5]
    const fundamentalFreq = outputData[0] * 1000; // Denormalize if needed
    const harmonicAmplitudes = outputData.slice(1);
    // Cleanup
    tf.dispose([input, output]);
    return {
      fundamentalFreq,
      harmonicAmplitudes
    };
  }
}
