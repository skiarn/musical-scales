
"use client";

import { Captured, Region } from "./DatasetCapture";
import { getAllNotes, GuitarNote } from "../../utils/guitar-frequencies";
import styles from "./DatasetCaptureRegions.module.css";

interface DatasetCaptureRegionsProps {
    captured: Captured | null;
}

interface Match {
    freq: number;
    match: GuitarNote | null;
    diff: number;
}

export default function DatasetCaptureRegions({ captured }: DatasetCaptureRegionsProps) {
    const getNoteMatches = (freqs: number[]): Match[] => {
        const notes = getAllNotes();
        const matches = freqs.map(f => {
            let best = null as GuitarNote | null; let bestDiff = Infinity;
            for (const n of notes) {
                const d = Math.abs(n.frequency - f);
                if (d < bestDiff) { bestDiff = d; best = n; }
            }
            // accept match if within 3 Hz OR within 3% relative
            if (best && (bestDiff <= 3 || bestDiff / best.frequency <= 0.03)) return { freq: f, match: best, diff: bestDiff };
            return { freq: f, match: null, diff: bestDiff };
        });
        return matches;
    };

    return <div className={styles.regions}>
        <div style={{ color:'white', fontSize: 13, fontWeight: 600 }}>Captured Regions & Peaks</div>
        {!captured && <div style={{  color: 'white', marginTop: 6 }}>No captured sample yet.</div>}
        {captured && (
            <div>
                {(captured.meta?.regions || []).map((r: Region, idx: number) => (
                    <div key={idx} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                        <div style={{ color: 'white', fontSize: 12 }}>Region {idx + 1}: samples {r.end - r.start}</div>
                        <div style={{ color: 'white', fontSize: 12 }}>Peaks: {r.peaks.join(', ')}</div>
                        <div style={{ color: 'white', fontSize: 12 }}>
                            Matches: {JSON.stringify(getNoteMatches(r.peaks).map((m: Match) => m.match ? `${m.match.note}${m.match.fret}@${m.match.string}` : `?(${Math.round(m.freq)}Hz)`))}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
}