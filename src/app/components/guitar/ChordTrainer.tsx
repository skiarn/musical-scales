import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./ChordTrainer.css";

// Types
interface ChordPosition {
  string: number;
  fret: number;
}

type ChordName = keyof typeof CHORDS;

interface ChordDiagramProps {
  chordName: string;
  positions: ChordPosition[];
  small?: boolean;
}

// Define common open chords
const CHORDS: Record<string, ChordPosition[]> = {
  C: [
    { string: 1, fret: 0 },
    { string: 2, fret: 1 },
    { string: 3, fret: 0 },
    { string: 4, fret: 2 },
    { string: 5, fret: 3 },
    { string: 6, fret: -1 },
  ],
  G: [
    { string: 1, fret: 3 },
    { string: 2, fret: 0 },
    { string: 3, fret: 0 },
    { string: 4, fret: 0 },
    { string: 5, fret: 2 },
    { string: 6, fret: 3 },
  ],
  D: [
    { string: 1, fret: 2 },
    { string: 2, fret: 3 },
    { string: 3, fret: 2 },
    { string: 4, fret: 0 },
    { string: 5, fret: -1 },
    { string: 6, fret: -1 },
  ],
  E: [
    { string: 1, fret: 0 },
    { string: 2, fret: 0 },
    { string: 3, fret: 1 },
    { string: 4, fret: 2 },
    { string: 5, fret: 2 },
    { string: 6, fret: 0 },
  ],
  A: [
    { string: 1, fret: 0 },
    { string: 2, fret: 2 },
    { string: 3, fret: 2 },
    { string: 4, fret: 2 },
    { string: 5, fret: 0 },
    { string: 6, fret: -1 },
  ],
  Am: [
    { string: 1, fret: 0 },
    { string: 2, fret: 1 },
    { string: 3, fret: 2 },
    { string: 4, fret: 2 },
    { string: 5, fret: 0 },
    { string: 6, fret: -1 },
  ],
  Em: [
    { string: 1, fret: 0 },
    { string: 2, fret: 0 },
    { string: 3, fret: 0 },
    { string: 4, fret: 2 },
    { string: 5, fret: 2 },
    { string: 6, fret: 0 },
  ],
  Dm: [
    { string: 1, fret: 1 },
    { string: 2, fret: 3 },
    { string: 3, fret: 2 },
    { string: 4, fret: 0 },
    { string: 5, fret: -1 },
    { string: 6, fret: -1 },
  ],
  F: [
    { string: 1, fret: 1 },
    { string: 2, fret: 1 },
    { string: 3, fret: 2 },
    { string: 4, fret: 3 },
    { string: 5, fret: 3 },
    { string: 6, fret: 1 },
  ],
};

function ChordDiagram({ chordName, positions, small = false }: ChordDiagramProps) {
  const frets = 4;
  const strings = 6;
  const width = small ? 50 : 80;
  const height = small ? 70 : 100;

  return (
    <div className="chord-diagram">
      {!small && <span className="chord-name">{chordName}</span>}
      <svg width={width} height={height}>
        {/* Strings */}
        {[...Array(strings)].map((_, i) => (
          <line
            key={i}
            x1={(i * (width - 10)) / (strings - 1)}
            y1={20}
            x2={(i * (width - 10)) / (strings - 1)}
            y2={height - 10}
            stroke="black"
          />
        ))}
        {/* Frets */}
        {[...Array(frets + 1)].map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={20 + (i * (height - 30)) / frets}
            x2={width - 10}
            y2={20 + (i * (height - 30)) / frets}
            stroke="black"
          />
        ))}
        {/* Notes */}
        {positions.map((p, i) => {
          if (p.fret === -1) {
            return (
              <text
                key={i}
                x={(i * (width - 10)) / (strings - 1)}
                y={15}
                fontSize={small ? "8" : "10"}
                textAnchor="middle"
              >
                x
              </text>
            );
          }
          if (p.fret === 0) {
            return (
              <circle
                key={i}
                cx={(i * (width - 10)) / (strings - 1)}
                cy={20}
                r={small ? 3 : 5}
                fill="black"
              />
            );
          }
          return (
            <circle
              key={i}
              cx={(i * (width - 10)) / (strings - 1)}
              cy={20 + (p.fret * (height - 30)) / frets}
              r={small ? 4 : 6}
              fill="black"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function ChordTrainer() {
  const [sequence, setSequence] = useState<ChordName[]>(["C", "G", "Am", "F"]);
  const [playing, setPlaying] = useState<boolean>(false);
  const [current, setCurrent] = useState<number>(0);
  const [tempo, setTempo] = useState<number>(2000); // ms per chord
  const [newChord, setNewChord] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % sequence.length);
    }, tempo);
    return () => clearInterval(interval);
  }, [playing, sequence, tempo]);

  const addChord = () => {
    if (newChord && CHORDS[newChord]) {
      setSequence([...sequence, newChord as ChordName]);
      setNewChord("");
      setShowSuggestions(false);
    }
  };

  const removeChord = (index: number) => {
    setSequence(sequence.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const suggestion = Object.keys(CHORDS).filter((chord) =>
      chord.toLowerCase().startsWith(newChord.toLowerCase())
    );
    console.log("Suggestions for", newChord, ":", suggestion);
    setFilteredSuggestions(suggestion);
  }, [newChord]);

  return (
    <div className="trainer-container">
      <h1 className="trainer-title">🎸 Practice Guitar Chords</h1>
      <div className="chord-display">
        {sequence.map((chord, index) => (
          <motion.div
            key={index}
            initial={{ x: 200 }}
            animate={{ x: index === current ? 0 : -200, opacity: index === current ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="absolute"
          >
            <ChordDiagram chordName={chord} positions={CHORDS[chord] || []} />
          </motion.div>
        ))}
      </div>

      <button className="btn" onClick={() => setPlaying(!playing)}>
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>
      <div className="card">
        <div className="card-content">
            <div className="input-group">
              <input
                className="input"
                placeholder="Enter chord (C, G, Am, D, etc.)"
                value={newChord}
                onChange={(e) => {
                  setNewChord(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="suggestions">
                  {filteredSuggestions.map((chord, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setNewChord(chord);
                        setShowSuggestions(false);
                      }}
                      className="suggestion-item"
                    >
                      <ChordDiagram chordName={chord} positions={CHORDS[chord]} small={true} />
                      <span>{chord}</span>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn" onClick={addChord}>Add</button>
          </div>


          <div className="sequence-list">
            {sequence.map((chord, i) => (
              <div key={i} className={`sequence-item ${i === current ? "active" : ""}`}>
                <ChordDiagram chordName={chord} positions={CHORDS[chord]} small={true} />
                <span>{chord}</span>
                <button className="remove-btn" onClick={() => removeChord(i)}>✕</button>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Tempo (ms per chord)</label>
            <input
              className="input"
              type="number"
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      
    </div>
  );
}