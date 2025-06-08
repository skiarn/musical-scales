import { useEffect, useState, useMemo } from "react";
import GuitarNoteAnalyzer from "./GuitarNoteTable";
import GuitarNoteSelector from "./GuitarNoteSelector";
import { guitarNotes, GuitarNote } from "../utils/guitar-frequencies";
import GuitarNoteTable from "./GuitarNoteTable";
import { analyzeFrequencies } from "../utils/signal-processing";

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
}

export const GuitarSection: React.FC<GuitarSectionProps> = ({ fftData, minSnr, minFrequency, maxFrequency, maxPeaks }) => {
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
    const significantPeaks = analysisResult.peaks
      .filter(peak => peak.harmonics.length >= 1) // Only keep peaks with harmonics
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
      })
      // Sort by number of harmonics and amplitude
      .sort((a, b) => 
        (b.harmonicCount - a.harmonicCount) || 
        (b.note.amplitude - a.note.amplitude)
      )
      // Take the top 3 most likely notes
      .slice(0, 3);

    setActiveNotes(significantPeaks);
  }, [fftData, analysisOptions]); // Stable dependency array

  return (
    <div className="guitar-section">
      <h2>Guitar Fretboard</h2>
      <GuitarNoteSelector
        activeNotes={activeNotes.map((n) => n.note)}
        frequencyTolerance={5}
      />
      <GuitarNoteTable
         highlightFrequencies={activeNotes.map((n)=> n.note.frequency)} // Optional: frequencies to highlight
         toleranceHz={1}   
      />
    </div>
  );
};
