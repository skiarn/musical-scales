"use client";

import React, { useRef, useState } from 'react';
import AudioButton from './AudioButton';
import AudioPlayButton from './AudioPlayButton';

interface AudioRecorderProps {
  onStop: (recordedData: Float32Array, sampleRate: number) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onStop }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
    
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleMouseDown = async () => {
    setAudioUrl(null);
    const AudioContext = window.AudioContext || (window as Window).webkitAudioContext;
    audioContextRef.current = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current);
      const audioUrl = URL.createObjectURL(audioBlob); 
      setAudioUrl(audioUrl);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      onStop(channelData, sampleRate);
      audioChunksRef.current = [];
    };

    reset();
    mediaRecorderRef.current.start();
  };

  const handleMouseUp = () => {
    mediaRecorderRef.current?.stop();
  };

  const reset = () => {
    mediaRecorderRef.current?.stop();
    audioChunksRef.current = [];
  }

  
  return (
    <div>
      <AudioButton
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
      </AudioButton>
      {audioUrl && <AudioPlayButton audioSrc={audioUrl}></AudioPlayButton> }
    </div>
  );
};

export default AudioRecorder;
