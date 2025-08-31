"use client";

import React from 'react';
import './AudioLoadChordButton.css';

interface AudioLoadChordButtonProps {
    chord: string
    onStop: (recordedData: Float32Array, sampleRate: number) => void;
    setAudioUrl: (value: React.SetStateAction<string | null>) => void;
}

const AudioLoadChordButton: React.FC<AudioLoadChordButtonProps> = ({chord, onStop, setAudioUrl}) => {
  const [loading, setLoading] = React.useState(false);

  return (
    <button
      className={`audio-load-chord-button ${loading ? 'loading' : ''}`}
      disabled={loading}
      onClick={async () => {
        setAudioUrl(null);
        setLoading(true);
        const urlPath =  `${process.env.basePath}/data/guitar/chords/${chord}.m4a`;
        setAudioUrl(urlPath);
        const fetchAndProcessAudio = async () => {
          const response = await fetch(urlPath);
          const arrayBuffer = await response.arrayBuffer();
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          const sampleRate = audioBuffer.sampleRate;
          onStop(channelData, sampleRate);
        };
        fetchAndProcessAudio();
        setLoading(false);
      }}
    >
      {loading ? 'Loading...' : `Load ${chord} Chord`}
    </button>
  );
};

export default AudioLoadChordButton;
