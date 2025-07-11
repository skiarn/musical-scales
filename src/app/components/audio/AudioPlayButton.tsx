import React, { useState, useEffect } from 'react';
import './AudioPlayButton.css';
type AudioPlayButtonProps = {
  audioSrc: string;
};

const AudioPlayButton: React.FC<AudioPlayButtonProps> = ({ audioSrc }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio] = useState(new Audio(audioSrc));

  useEffect(() => {
    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0; // Ensure the audio is reset to the beginning
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio]);

  const togglePlay = () => {
    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0; // Reset the audio to the beginning
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <button onClick={togglePlay} className={`audio-play-button ${isPlaying ? 'playing' : ''}`}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
};

export default AudioPlayButton;
