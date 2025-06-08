"use client";

import React from 'react';
import './AudioLoadNoteButton.css';
import { generateGNoteBlob } from '../utils/guitar-sample-generator';

interface AudioLoadNoteButtonProps {
    onStop: (recordedData: Float32Array, sampleRate: number) => void;
    setAudioUrl: (value: React.SetStateAction<string | null>) => void;
}

const AudioLoadNoteButton: React.FC<AudioLoadNoteButtonProps> = ({onStop, setAudioUrl}) => {
  const [loading, setLoading] = React.useState(false);

  return (
    <button
      className={`audio-load-note-button ${loading ? 'loading' : ''}`}
      disabled={loading}
      onClick={async () => {
        setAudioUrl(null);
        setLoading(true);
        const sampleRate = 8000;
        const duration = 0.5; // Reduced from 2 seconds to get smaller data size
        const gNoteBlob = generateGNoteBlob(duration, sampleRate);
        // Convert blob to array buffer for FFT analysis
        gNoteBlob.arrayBuffer().then(buffer => {
          const audioContext = new AudioContext();
          return audioContext.decodeAudioData(buffer);
        }).then(audioBuffer => {
          const channelData = audioBuffer.getChannelData(0);
          onStop(channelData, sampleRate);
          const audioUrl = URL.createObjectURL(gNoteBlob); 
          setAudioUrl(audioUrl);
        }).finally(() => {
          setLoading(false);
        });

      }}
    >
      {loading ? 'Loading...' : 'Load G Note Sample'}
    </button>
  );
};

export default AudioLoadNoteButton;
