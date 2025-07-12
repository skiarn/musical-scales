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
      this.model = await tf.loadLayersModel('/models/harmonics_autoencoder/model.json');
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
    const [_, fundamental, harmonics] = this.model.predict(input) as tf.Tensor[];
    
    // Convert to JavaScript values
    const fundamentalFreq = (await fundamental.data())[0] * 1000; // Denormalize
    const harmonicAmplitudes = Array.from(await harmonics.data());
    
    // Cleanup
    tf.dispose([input, fundamental, harmonics]);
    
    return {
      fundamentalFreq,
      harmonicAmplitudes
    };
  }
}
