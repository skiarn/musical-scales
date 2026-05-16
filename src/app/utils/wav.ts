import { SampleMetadata } from "../components/guitar/DatasetCapture";

export function float32ToWav(samples: Float32Array, sampleRate: number, metadata?: SampleMetadata): Blob {
    const numChannels = 1;
    const dataSize = samples.length * 2;
    let metaBytes: Uint8Array | null = null;
    if (metadata) metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const metaChunkSize = metaBytes ? (8 + metaBytes.length + (metaBytes.length % 2 === 1 ? 1 : 0)) : 0;
    const buffer = new ArrayBuffer(44 + dataSize + metaChunkSize);
    const view = new DataView(buffer);
    const writeString = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize + metaChunkSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    if (metaBytes) {
        const metaOffset = 44 + dataSize;
        writeString(metaOffset, "meta");
        view.setUint32(metaOffset + 4, metaBytes.length, true);
        for (let i = 0; i < metaBytes.length; i++) view.setUint8(metaOffset + 8 + i, metaBytes[i]);
        if (metaBytes.length % 2 === 1) view.setUint8(metaOffset + 8 + metaBytes.length, 0);
    }
    return new Blob([buffer], { type: "audio/wav" });
};


export function parseWavMeta(arrayBuffer: ArrayBuffer): SampleMetadata | null {
    try {
        const view = new DataView(arrayBuffer);
        if (view.byteLength < 12) return null;
        const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
        if (riff !== 'RIFF' || wave !== 'WAVE') return null;
        let offset = 12;
        while (offset + 8 <= view.byteLength) {
            const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
            const size = view.getUint32(offset + 4, true);
            const dataStart = offset + 8;
            if (dataStart + size > view.byteLength) break;
            if (id === 'meta') {
                const bytes = new Uint8Array(arrayBuffer, dataStart, size);
                const txt = new TextDecoder().decode(bytes);
                try { return JSON.parse(txt); } catch (e) {
                    console.error('Error parsing WAV meta JSON', e);
                    return null;
                }
            }
            offset = dataStart + size + (size % 2);
        }
    } catch (e) {
        // ignore parse errors
        console.warn('parseWavMeta error', e);
    }
    return null;
}

export async function blobToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as Window).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Interleave channels
    const interleaved = new Float32Array(length * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            interleaved[i * numChannels + ch] = channelData[i];
        }
    }

    // WAV file: 44-byte header + 16-bit PCM samples
    const wavBuffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(wavBuffer);
    const writeString = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format = 1 (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
    view.setUint16(32, numChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, interleaved.length * 2, true);

    // write PCM samples (16-bit little endian)
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    if (audioCtx.close) await audioCtx.close();
    return new Blob([view], { type: "audio/wav" });
};