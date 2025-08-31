"use client";

import React from 'react';
import './AudioLoadChordButton.css';
import { generateGNoteBlob } from '../../utils/guitar-sample-generator';

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
        setLoading(false);
      }}
    >
      {loading ? 'Loading...' : `Load ${chord} Chord`}
    </button>
  );
};

export default AudioLoadChordButton;
