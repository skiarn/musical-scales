"use client";

import React from 'react';
import './AudioButton.css';

interface AudioButtonProps {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
}

const StyledButton: React.FC<AudioButtonProps> = ({ onMouseDown, onMouseUp, onTouchStart, onTouchEnd }) => {
  return (
    <button
      className="audio-button"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      Hold to Record
    </button>
  );
};

export default StyledButton;
