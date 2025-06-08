import React from 'react';
import { guitarNotes, GuitarNote } from '../utils/guitar-frequencies';

interface GuitarNoteSelectorProps {
  selectedNotes?: GuitarNote[];
  activeNotes?: GuitarNote[];
  onNoteSelect?: (note: GuitarNote) => void;
  highlightFrequency?: number;
  frequencyTolerance?: number;
}

const GuitarNoteSelector: React.FC<GuitarNoteSelectorProps> = ({
  selectedNotes = [],
  activeNotes = [],
  onNoteSelect,
  highlightFrequency,
  frequencyTolerance = 5
}) => {
  const FRETS = 12;
  const STRINGS = 6;
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 200;
  const FRET_START = 50;
  const FRET_WIDTH = (SVG_WIDTH - FRET_START) / (FRETS + 1);
  const STRING_SPACING = SVG_HEIGHT / (STRINGS + 1);

  const isNoteHighlighted = (note: GuitarNote) => {
    if (highlightFrequency && Math.abs(note.frequency - highlightFrequency) <= frequencyTolerance) {
      return true;
    }
    return selectedNotes.some(n => n.string === note.string && n.fret === note.fret);
  };

  const isNoteActive = (note: GuitarNote) => {
    return activeNotes.some(active => 
      active.string === note.string && 
      active.fret === note.fret
    );
  };

  const renderFretMarkers = () => {
    const markers = [3, 5, 7, 9, 12];
    return markers.map(fret => (
      <circle
        key={`marker-${fret}`}
        cx={FRET_START + (FRET_WIDTH * fret) - (FRET_WIDTH / 2)}
        cy={SVG_HEIGHT / 2}
        r={5}
        fill="#d4d4d4"
      />
    ));
  };

  return (
    <div className="guitar-fretboard">
      <svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        {/* Background */}
        <rect x={FRET_START} y={20} width={SVG_WIDTH - FRET_START} height={SVG_HEIGHT - 40} fill="#f8d49c" />
        
        {/* Nut */}
        <rect x={FRET_START} y={20} width={4} height={SVG_HEIGHT - 40} fill="#444" />
        
        {/* Frets */}
        {Array.from({ length: FRETS + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={FRET_START + (FRET_WIDTH * i)}
            y1={20}
            x2={FRET_START + (FRET_WIDTH * i)}
            y2={SVG_HEIGHT - 20}
            stroke="#999"
            strokeWidth={2}
          />
        ))}
        
        {/* Fret markers */}
        {renderFretMarkers()}
        
        {/* Strings */}
        {Array.from({ length: STRINGS }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={FRET_START}
            y1={STRING_SPACING * (i + 1)}
            x2={SVG_WIDTH - 20}
            y2={STRING_SPACING * (i + 1)}
            stroke="#666"
            strokeWidth={2 + (STRINGS - i) * 0.5}
          />
        ))}
        
        {/* Notes */}
        {Object.values(guitarNotes).flat().map((note) => {
          const isHighlighted = isNoteHighlighted(note);
          const isActive = isNoteActive(note);
          const x = FRET_START + (note.fret * FRET_WIDTH) - (FRET_WIDTH / 2);
          const y = STRING_SPACING * note.string;
          
          return (
            <g
              key={`note-${note.string}-${note.fret}`}
              onClick={() => onNoteSelect?.(note)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={x}
                cy={y}
                r={12}
                fill={isActive ? '#4CAF50' : isHighlighted ? '#4CAF50' : 'white'}
                stroke="#333"
                strokeWidth={1}
                className={isActive ? 'note-highlight' : ''}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill={isActive || isHighlighted ? 'white' : 'black'}
              >
                {note.note}
              </text>
            </g>
          );
        })}
        
        {/* String labels */}
        {Array.from({ length: STRINGS }).map((_, i) => (
          <text
            key={`label-${i}`}
            x={30}
            y={STRING_SPACING * (i + 1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fontWeight="bold"
          >
            {guitarNotes[i+1][0].note}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default GuitarNoteSelector;
