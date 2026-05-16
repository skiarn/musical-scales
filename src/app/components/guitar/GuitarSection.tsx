import { useEffect, useState, useMemo } from "react";
import GuitarNoteSelector from "./GuitarNoteSelector";
import { guitarNotes, GuitarNote } from "../../utils/guitar-frequencies";
import GuitarNoteTable from "./GuitarNoteTable";
import { analyzeFrequencies } from "../../utils/signal-processing";

// Add helper function to find closest guitar note
const findClosestGuitarNote = (frequency: number): GuitarNote => {
  return Object.values(guitarNotes).flat().reduce((closest, current) => {
    const currentDiff = Math.abs(current.frequency - frequency);
    const closestDiff = Math.abs(closest.frequency - frequency);
    return currentDiff < closestDiff ? current : closest;
  });
};

interface GuitarSectionProps {
  fftData: { x: number; y: number }[];
  minSnr?: number;
  minFrequency?: number;
  maxFrequency?: number;
  maxPeaks?: number;
  onNoteSelect?: (note: GuitarNote) => void;
}

export const GuitarSection: React.FC<GuitarSectionProps> = ({ fftData, minSnr, minFrequency, maxFrequency, maxPeaks, onNoteSelect }) => {
  const [activeNotes, setActiveNotes] = useState<
    { note: GuitarNote; timestamp: number }[]
  >([]);

  // Memoize analysis options to keep them stable
  const analysisOptions = useMemo(() => ({
    minSnr,
    minFrequency,
    maxFrequency,
    maxPeaks
  }), [minSnr, minFrequency, maxFrequency, maxPeaks]);

  // Find active notes based on the analysis result
  useEffect(() => {
    const now = Date.now();

    const analysisResult = analyzeFrequencies(fftData, analysisOptions);

    // Filter peaks that have harmonics and match to guitar notes
    const significantPeaks = analysisResult.peaks.slice(0,3)
      .map(peak => {
        const closestNote = findClosestGuitarNote(peak.frequency);
        return {
          note: {
            ...closestNote,
            amplitude: peak.amplitude,
          },
          timestamp: now,
          harmonicCount: peak.harmonics.length
        };
      });

    setActiveNotes(significantPeaks);
  }, [fftData, analysisOptions]); // Stable dependency array

  return (
    <div className="guitar-section">
      <h2>Guitar Fretboard</h2>
      <GuitarNoteSelector
        activeNotes={activeNotes.map((n) => n.note)}
        frequencyTolerance={5}
        onNoteSelect={(note) => {
          onNoteSelect?.(note);
        }}
      />
      <GuitarNoteTable
         highlightFrequencies={activeNotes.map((n)=> n.note.frequency)} // Optional: frequencies to highlight
         toleranceHz={1}   
        />
    </div>
  );
};
