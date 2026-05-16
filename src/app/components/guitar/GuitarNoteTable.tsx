import React, { useMemo } from 'react';
import { guitarNotes, GuitarNote } from '../../utils/guitar-frequencies';
import './GuitarNoteTable.css';

interface GuitarNoteTableProps {
  highlightFrequencies?: number[];
  toleranceHz?: number;
}

const GuitarNoteTable: React.FC<GuitarNoteTableProps> = ({
  highlightFrequencies = [],
  toleranceHz = 1
}) => {
  const structuredNotes = useMemo(() => {
    const strings = new Array(6).fill(null).map(() => new Array(13).fill(null));
    Object.values(guitarNotes).flat().forEach((note: GuitarNote) => {
      strings[note.string-1][note.fret] = note;
    });
    return strings;
  }, []);

  const isFrequencyMatched = (frequency: number) => {
    return highlightFrequencies.some(f => Math.abs(f - frequency) <= toleranceHz);
  };

  return (
    <div className="guitar-note-table">
      <h3>Guitar Fretboard Frequencies</h3>
      <p>{highlightFrequencies.join(", ")}</p>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>String</th>
              {Array.from({ length: 13 }, (_, i) => (
                <th key={i}>{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {structuredNotes.map((_, stringIndex) => {
              const idx = 5 - stringIndex;
              const stringNotes = structuredNotes[idx];
              return (
                <tr key={idx}>
                  <td><strong>String {idx + 1}</strong></td>
                  {stringNotes.map((note, fretIndex) => (
                    <td
                      key={fretIndex}
                      className={note && isFrequencyMatched(note.frequency) ? 'highlighted' : ''}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default React.memo(GuitarNoteTable);
