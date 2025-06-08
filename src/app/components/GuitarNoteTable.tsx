import React, { useMemo } from 'react';
import { guitarNotes, GuitarNote } from '../utils/guitar-frequencies';

interface GuitarNoteTableProps {
  highlightFrequencies?: number[];  // Frequencies to highlight
  toleranceHz?: number;            // Tolerance for frequency matching
}

const GuitarNoteTable: React.FC<GuitarNoteTableProps> = ({
  highlightFrequencies = [],
  toleranceHz = 1
}) => {
  const structuredNotes = useMemo(() => {
    // Create a 2D array: [string][fret]
    const strings = new Array(6).fill(null).map(() => new Array(13).fill(null));
    
    // Organize notes by string and fret
    Object.values(guitarNotes).flat().forEach((note: GuitarNote) => {
      strings[note.string-1][note.fret] = note;
    });

    return strings;
  }, []);

  const isFrequencyMatched = (frequency: number) => {
    return highlightFrequencies.some(f => 
      Math.abs(f - frequency) <= toleranceHz
    );
  };

  return (
    <div className="guitar-note-table">
      <h3>Guitar Fretboard Frequencies</h3>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>String</th>
              {Array.from({ length: 13 }, (_, i) => (
                <th key={i}>{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {structuredNotes.map((stringNotes, stringIndex) => (
              <tr key={6 - stringIndex}>
                <td><strong>String {6 - stringIndex}</strong></td>
                {stringNotes.map((note, fretIndex) => (
                  <td 
                    key={fretIndex}
                    style={{
                      padding: '4px 8px',
                      textAlign: 'center',
                      backgroundColor: note && isFrequencyMatched(note.frequency) 
                        ? '#90EE90' 
                        : 'transparent',
                      border: '1px solid #ddd'
                    }}
                  >
                    {note && (
                      <div>
                        <div>{note.note}</div>
                        <small>{note.frequency.toFixed(1)}Hz</small>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .guitar-note-table {
          margin: 20px 0;
        }
        .table-container {
          max-width: 100%;
          margin-top: 10px;
        }
        table td, table th {
          border: 1px solid #ddd;
          padding: 4px 8px;
        }
        table th {
          background-color: #f5f5f5;
        }
      `}</style>
    </div>
  );
};

export default React.memo(GuitarNoteTable);
