// Add proper type for WebKit prefix
interface WebkitWindow extends Window {
  webkitAudioContext: typeof AudioContext;
}

// Add a singleton audio context manager
let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as WebkitWindow).webkitAudioContext;
    audioContextInstance = new AudioContextClass();
  }
  return audioContextInstance;
}

function generateGuitarSample(frequency: number, duration: number, sampleRate: number): Float32Array {
    const numSamples = Math.floor(sampleRate * duration);
    const audioData = new Float32Array(numSamples);
    
    // Guitar string harmonics relative amplitudes
    const harmonics = [
        { multiplier: 1, amplitude: 1.0 },    // Fundamental
        { multiplier: 2, amplitude: 0.5 },    // First harmonic
        { multiplier: 3, amplitude: 0.25 },   // Second harmonic
        { multiplier: 4, amplitude: 0.125 },  // Third harmonic
        { multiplier: 5, amplitude: 0.06 },   // Fourth harmonic
        { multiplier: 6, amplitude: 0.03 }    // Fifth harmonic
    ];

    // Generate the waveform
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let sample = 0;

        // Add harmonics
        for (const harmonic of harmonics) {
            sample += Math.sin(2 * Math.PI * frequency * harmonic.multiplier * t) * 
                     harmonic.amplitude * 
                     Math.exp(-t * 2); // Decay factor
        }

        // Normalize and add some attack
        const attackTime = 0.02;
        const attack = t < attackTime ? t / attackTime : 1;
        audioData[i] = sample * attack * 0.5; // Scale to prevent clipping
    }

    return audioData;
}

function playGuitarNote(frequency: number, duration: number = 2): Promise<void> {
  const audioContext = getAudioContext();
  
  // Resume context if it's suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const sampleRate = audioContext.sampleRate;
  const audioData = generateGuitarSample(frequency, duration, sampleRate);
  
  const buffer = audioContext.createBuffer(1, audioData.length, sampleRate);
  buffer.getChannelData(0).set(audioData);
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  
  // Add subtle reverb
  const convolver = audioContext.createConvolver();
  const reverbTime = 2;
  const decay = 0.1;
  const reverbBuffer = createReverbBuffer(audioContext, reverbTime, decay);
  convolver.buffer = reverbBuffer;
  
  // Add dynamics processing
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;
  
  source.connect(compressor);
  compressor.connect(convolver);
  convolver.connect(audioContext.destination);
  
  return new Promise((resolve) => {
    source.onended = () => {
      // Don't close the context, just disconnect the nodes
      source.disconnect();
      compressor.disconnect();
      convolver.disconnect();
      resolve();
    };
    source.start();
  });
}

function createReverbBuffer(context: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = context.sampleRate * duration;
    const buffer = context.createBuffer(2, length, context.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    
    return buffer;
}

// Generate G note (196 Hz - G3 on guitar)
function generateGNote(sampleRate: number, duration: number): Float32Array {
    return generateGuitarSample(196, duration, sampleRate); // 2 seconds duration
}

// Playable G note function
function playGNote(): Promise<void> {
    return playGuitarNote(196);
}

function createAudioBlob(audioData: Float32Array, sampleRate: number): Blob {
    // Create WAV file structure
    const wavHeader = createWavHeader(audioData.length, sampleRate);
    const audioBuffer = new Int16Array(audioData.map(x => x * 32767)); // Convert to 16-bit PCM
    
    // Combine header and audio data
    const blob = new Blob([wavHeader, audioBuffer], { type: 'audio/wav' });
    return blob;
}

function createWavHeader(dataLength: number, sampleRate: number): ArrayBuffer {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength * 2, true);
    writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength * 2, true);
    
    return header;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function generateGNoteBlob(duration: number, sampleRate: number): Blob {
    const audioData = generateGNote(sampleRate, duration);
    return createAudioBlob(audioData, sampleRate);
}


// Make sure all exports are properly defined
export {
    generateGuitarSample,
    playGuitarNote,
    generateGNote,
    playGNote,
    createAudioBlob,
    generateGNoteBlob,
};
