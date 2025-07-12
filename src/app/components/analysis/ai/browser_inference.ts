import { HarmonicsAutoencoder, HarmonicsData } from './harmonics_autoencoder';

export class BrowserInference {
  private model: HarmonicsAutoencoder;

  constructor() {
    this.model = new HarmonicsAutoencoder();
  }

  public async analyzeWaveform(data: { x: number; y: number }[]): Promise<HarmonicsData> {
    const waveform = data.map(point => point.y);
    return await this.model.encode(waveform);
  }
}
