
export interface GuitarNote {
    string: number;
    fret: number;
    note: string;
    frequency: number;
    signalStrength?: number; // Optional property for signal strength
  }

  export const guitarNotes: { [key: number]: GuitarNote[] } = {
    6: [ // High E string
      { string: 6, fret: 0, note: 'E', frequency: 330 },
      { string: 6, fret: 1, note: 'F', frequency: 349 },
      { string: 6, fret: 2, note: 'F#', frequency: 370 },
      { string: 6, fret: 3, note: 'G', frequency: 392 },
      { string: 6, fret: 4, note: 'G#', frequency: 415 },
      { string: 6, fret: 5, note: 'A', frequency: 440 },
      { string: 6, fret: 6, note: 'A#', frequency: 466 },
      { string: 6, fret: 7, note: 'B', frequency: 494 },
      { string: 6, fret: 8, note: 'C', frequency: 523 },
      { string: 6, fret: 9, note: 'C#', frequency: 554 },
      { string: 6, fret: 10, note: 'D', frequency: 587 },
      { string: 6, fret: 11, note: 'D#', frequency: 622 },
      { string: 6, fret: 12, note: 'E', frequency: 659 },
    ],
    5: [ // B string
      { string: 5, fret: 0, note: 'B', frequency: 247 },
      { string: 5, fret: 1, note: 'C', frequency: 262 },
      { string: 5, fret: 2, note: 'C#', frequency: 278 },
      { string: 5, fret: 3, note: 'D', frequency: 294 },
      { string: 5, fret: 4, note: 'D#', frequency: 311 },
      { string: 5, fret: 5, note: 'E', frequency: 330 },
      { string: 5, fret: 6, note: 'F', frequency: 349 },
      { string: 5, fret: 7, note: 'F#', frequency: 370 },
      { string: 5, fret: 8, note: 'G', frequency: 392 },
      { string: 5, fret: 9, note: 'G#', frequency: 415 },
      { string: 5, fret: 10, note: 'A', frequency: 440 },
      { string: 5, fret: 11, note: 'A#', frequency: 466 },
      { string: 5, fret: 12, note: 'B', frequency: 494 },
    ],
    4: [ // G string
      { string: 4, fret: 0, note: 'G', frequency: 196 },
      { string: 4, fret: 1, note: 'G#', frequency: 208 },
      { string: 4, fret: 2, note: 'A', frequency: 220 },
      { string: 4, fret: 3, note: 'A#', frequency: 233 },
      { string: 4, fret: 4, note: 'B', frequency: 247 },
      { string: 4, fret: 5, note: 'C', frequency: 262 },
      { string: 4, fret: 6, note: 'C#', frequency: 278 },
      { string: 4, fret: 7, note: 'D', frequency: 294 },
      { string: 4, fret: 8, note: 'D#', frequency: 311 },
      { string: 4, fret: 9, note: 'E', frequency: 330 },
      { string: 4, fret: 10, note: 'F', frequency: 349 },
      { string: 4, fret: 11, note: 'F#', frequency: 370 },
      { string: 4, fret: 12, note: 'G', frequency: 392 },
    ],
    3: [ // D string
      { string: 3, fret: 0, note: 'D', frequency: 147 },
      { string: 3, fret: 1, note: 'D#', frequency: 156 },
      { string: 3, fret: 2, note: 'E', frequency: 165 },
      { string: 3, fret: 3, note: 'F', frequency: 175 },
      { string: 3, fret: 4, note: 'F#', frequency: 185 },
      { string: 3, fret: 5, note: 'G', frequency: 196 },
      { string: 3, fret: 6, note: 'G#', frequency: 208 },
      { string: 3, fret: 7, note: 'A', frequency: 220 },
      { string: 3, fret: 8, note: 'A#', frequency: 233 },
      { string: 3, fret: 9, note: 'B', frequency: 247 },
      { string: 3, fret: 10, note: 'C', frequency: 262 },
      { string: 3, fret: 11, note: 'C#', frequency: 278 },
      { string: 3, fret: 12, note: 'D', frequency: 294 },
    ],
    2: [ // A string
      { string: 2, fret: 0, note: 'A', frequency: 110 },
      { string: 2, fret: 1, note: 'A#', frequency: 117 },
      { string: 2, fret: 2, note: 'B', frequency: 124 },
      { string: 2, fret: 3, note: 'C', frequency: 131 },
      { string: 2, fret: 4, note: 'C#', frequency: 139 },
      { string: 2, fret: 5, note: 'D', frequency: 147 },
      { string: 2, fret: 6, note: 'D#', frequency: 156 },
      { string: 2, fret: 7, note: 'E', frequency: 165 },
      { string: 2, fret: 8, note: 'F', frequency: 175 },
      { string: 2, fret: 9, note: 'F#', frequency: 185 },
      { string: 2, fret: 10, note: 'G', frequency: 196 },
      { string: 2, fret: 11, note: 'G#', frequency: 208 },
      { string: 2, fret: 12, note: 'A', frequency: 220 },
    ],
    1: [ // Low E string
      { string: 1, fret: 0, note: 'E', frequency: 82 },
      { string: 1, fret: 1, note: 'F', frequency: 87 },
      { string: 1, fret: 2, note: 'F#', frequency: 93 },
      { string: 1, fret: 3, note: 'G', frequency: 98 },
      { string: 1, fret: 4, note: 'G#', frequency: 104 },
      { string: 1, fret: 5, note: 'A', frequency: 110 },
      { string: 1, fret: 6, note: 'A#', frequency: 117 },
      { string: 1, fret: 7, note: 'B', frequency: 124 },
      { string: 1, fret: 8, note: 'C', frequency: 131 },
      { string: 1, fret: 9, note: 'C#', frequency: 139 },
      { string: 1, fret: 10, note: 'D', frequency: 147 },
      { string: 1, fret: 11, note: 'D#', frequency: 156 },
      { string: 1, fret: 12, note: 'E', frequency: 165 },
    ],
  };

// Utility functions
export const getAllNotes = (): GuitarNote[] => {
  return Object.values(guitarNotes).flat();
};

export const getNoteByFrequency = (frequency: number): GuitarNote | undefined => {
  return getAllNotes().find(note => note.frequency === frequency);
};

export const getNotesByString = (stringNumber: number): GuitarNote[] => {
  return guitarNotes[stringNumber] || [];
};
