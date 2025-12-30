import React, { useState, useEffect, useRef } from "react";
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
  S1F0: [
    { string: 6, fret: 0 },
  ],
  S1F1: [
    { string: 6, fret: 1 },
  ],
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

  // Recording state
  const [recording, setRecording] = useState<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentChordRef = useRef<string | null>(null);
  const pendingFlushRef = useRef<string | null>(null);
  const recordingsRef = useRef<Array<{ chord: string; blob: Blob }>>([]);
  const [recordingsList, setRecordingsList] = useState<
    Array<{ chord: string; name: string; size: number }>
  >([]);

  // Support a ticking pulse so single-item loops re-trigger animations, and a "solo" index
  const [tick, setTick] = useState<number>(0);
  const [soloIndex, setSoloIndex] = useState<number | null>(null);
  const prevActiveIndexRef = useRef<number>(0);
  const prevTickRef = useRef<number>(0);

  // Pick a mimeType for MediaRecorder that's supported by the browser
  const chooseMimeType = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    try {
      if (typeof (MediaRecorder as any).isTypeSupported === "function") {
        for (const c of candidates) {
          if ((MediaRecorder as any).isTypeSupported(c)) return c;
        }
      }
    } catch (err) {
      // ignore
    }
    return undefined;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = chooseMimeType();
      if (mimeType) console.log("MediaRecorder mimeType:", mimeType);
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e: BlobEvent) => {
        const chordName = pendingFlushRef.current ?? segmentChordRef.current ?? "unknown";
        // Ensure blob has a type we expect
        const blob = e.data && e.data.size > 0 ? (e.data.type ? e.data : new Blob([e.data], { type: mimeType || "audio/webm" })) : new Blob();
        // Save the blob for the chord
        recordingsRef.current.push({ chord: chordName, blob });
        setRecordingsList(
          recordingsRef.current.map((r, idx) => ({
            chord: r.chord,
            name: `${idx + 1}-${r.chord}${r.blob.type.includes("ogg") ? ".ogg" : r.blob.type.includes("webm") ? ".webm" : ".audio"}`,
            size: r.blob.size,
          }))
        );
        pendingFlushRef.current = null;
      };

      mr.start(); // no timeslice; we'll use requestData() to flush chunks per chord
      segmentChordRef.current = sequence[current];
      recordingsRef.current = [];
      setRecordingsList([]);
      setRecording(true);
    } catch (err) {
      console.error("Could not access microphone:", err);
      alert("Could not access microphone. Please allow microphone access.");
    }
  };

  // Stop current recorder and optionally restart a new recorder for the next segment
  const flushAndMaybeRestart = (nextSegmentName?: string) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    // Mark the segment we want flushed
    pendingFlushRef.current = segmentChordRef.current;

    // Prepare an onstop handler that will restart if we are still in recording mode
    const handleStop = () => {
      mr.removeEventListener("stop", handleStop);
      // Don't restart if recording was cleared
      if (!recording) return;
      // create a fresh recorder to get a full container header in the next segment
      try {
        if (!mediaStreamRef.current) return;
        const mimeType = chooseMimeType();
        const newMr = mimeType ? new MediaRecorder(mediaStreamRef.current, { mimeType }) : new MediaRecorder(mediaStreamRef.current);
        mediaRecorderRef.current = newMr;
        newMr.ondataavailable = (e: BlobEvent) => {
          const chordName = pendingFlushRef.current ?? segmentChordRef.current ?? "unknown";
          const blob = e.data && e.data.size > 0 ? (e.data.type ? e.data : new Blob([e.data], { type: mimeType || "audio/webm" })) : new Blob();
          recordingsRef.current.push({ chord: chordName, blob });
          setRecordingsList(
            recordingsRef.current.map((r, idx) => ({
              chord: r.chord,
              name: `${idx + 1}-${r.chord}${r.blob.type.includes("ogg") ? ".ogg" : r.blob.type.includes("webm") ? ".webm" : ".audio"}`,
              size: r.blob.size,
            }))
          );
          pendingFlushRef.current = null;
        };
        // Start after a short delay to avoid race conditions
        setTimeout(() => {
          segmentChordRef.current = nextSegmentName ?? segmentChordRef.current;
          try {
            newMr.start();
          } catch (err) {
            console.error("Failed to restart MediaRecorder:", err);
          }
        }, 50);
      } catch (err) {
        console.error("Failed to rotate recorder:", err);
      }
    };

    // Attach then stop current recorder to trigger dataavailable+stop
    mr.addEventListener("stop", handleStop);
    try {
      mr.stop();
    } catch (err) {
      console.warn("Error stopping recorder during flush:", err);
      mr.removeEventListener("stop", handleStop);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    // Ensure we won't restart after this stop
    setRecording(false);
    // flush the last segment - this will not restart because recording flag is false
    pendingFlushRef.current = segmentChordRef.current;
    try {
      mediaRecorderRef.current.stop();
    } catch (err) {
      console.warn("Failed to stop MediaRecorder:", err);
    }
    // stop tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  // Convert an encoded audio Blob (webm/ogg) into a WAV Blob (PCM16) and return it
  const blobToWav = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
    const audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Interleave channels
    const interleaved = new Float32Array(length * numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        interleaved[i * numChannels + ch] = channelData[i];
      }
    }

    // WAV file: 44-byte header + 16-bit PCM samples
    const wavBuffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(wavBuffer);
    const writeString = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // format = 1 (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
    view.setUint16(32, numChannels * 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, "data");
    view.setUint32(40, interleaved.length * 2, true);

    // write PCM samples (16-bit little endian)
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, interleaved[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    if (audioCtx.close) await audioCtx.close();
    return new Blob([view], { type: "audio/wav" });
  };

  const downloadWavFile = async (idx: number) => {
    const r = recordingsRef.current[idx];
    if (!r) return;
    try {
      const wavBlob = await blobToWav(r.blob);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${idx + 1}-${r.chord}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to convert to WAV", err);
      alert("Failed to convert recording to WAV.");
    }
  };

  // Play a recording robustly: try HTMLAudioElement first, fall back to AudioContext decode if needed
  const playRecording = async (idx: number) => {
    const r = recordingsRef.current[idx];
    if (!r) return;
    if (r.blob.size === 0) {
      alert("Recording is empty");
      return;
    }

    const url = URL.createObjectURL(r.blob);
    const audioEl = new Audio();
    audioEl.src = url;
    audioEl.onended = () => URL.revokeObjectURL(url);

    try {
      // Try to play with the audio element (fast path)
      await audioEl.play();
      return;
    } catch (err) {
      console.warn("HTMLAudioElement playback failed, falling back to AudioContext:", err);
      // Revoke the object URL and try decode/play via AudioContext
      try {
        URL.revokeObjectURL(url);
      } catch {}
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as any;
        const ac = new AudioCtx();
        const buffer = await ac.decodeAudioData(await r.blob.arrayBuffer());
        const src = ac.createBufferSource();
        src.buffer = buffer;
        src.connect(ac.destination);
        src.start();
        src.onended = () => {
          try {
            ac.close();
          } catch {}
        };
      } catch (err2) {
        console.error("Fallback AudioContext playback failed:", err2);
        const bt = r.blob.type || "unknown";
        const msg = `Playback failed (recording type: ${bt}). Your browser may not support decoding this format.`;
        if (confirm(msg + "\nWould you like to download this recording as a WAV instead?")) {
          try {
            await downloadWavFile(idx);
          } catch (e) {
            console.error("Failed to download WAV fallback:", e);
            alert("Couldn't provide a WAV fallback. Try a different browser or check recording format.");
          }
        }
      }
    }
  };

  const downloadAllWavs = () => {
    recordingsRef.current.forEach((_, i) => {
      setTimeout(() => downloadWavFile(i), i * 300);
    });
  };

  // Active sequence respects soloIndex if set
  const activeSequence = soloIndex !== null ? [sequence[soloIndex]] : sequence;

  useEffect(() => {
    if (!playing || activeSequence.length === 0) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (activeSequence.length > 1 ? (prev + 1) % activeSequence.length : prev));
      setTick((t) => t + 1);
    }, tempo);
    return () => clearInterval(interval);
  }, [playing, activeSequence, tempo]);

  // If solo index becomes invalid (e.g. chord removed), clear it
  useEffect(() => {
    if (soloIndex !== null && soloIndex >= sequence.length) setSoloIndex(null);
  }, [sequence, soloIndex]);

  // Reset current when solo toggles
  useEffect(() => {
    setCurrent(0);
    setTick((t) => t + 1);
    prevActiveIndexRef.current = 0;
    prevTickRef.current = tick;
  }, [soloIndex]);

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

  // Keep ref of previous active index / tick to detect chord changes or per-beat ticks while recording
  useEffect(() => {
    if (recording && mediaRecorderRef.current && activeSequence.length > 0) {
      const prev = prevActiveIndexRef.current;
      if (prev !== current) {
        // flush the previous chord's audio and restart a fresh recorder for the next chord
        flushAndMaybeRestart(activeSequence[current]);
      } else if (activeSequence.length === 1 && prevTickRef.current !== tick) {
        // For single-item loop: rotate recorder on every tick so each cycle becomes its own chunk
        flushAndMaybeRestart(activeSequence[current]);
      }
    }
    prevActiveIndexRef.current = current;
    prevTickRef.current = tick;
  }, [current, recording, activeSequence, tick]);


  return (
    <div className="trainer-container">
      <h1 className="trainer-title">🎸 Practice Guitar Chords</h1>
      <div className="chord-display">
        {activeSequence.map((chord, index) => (
          <motion.div
            key={index === current ? `current-${index}-${tick}` : index}
            initial={{ x: 200 }}
            animate={{ x: index === current ? 0 : -200, opacity: index === current ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="absolute"
          >
            <ChordDiagram chordName={chord} positions={CHORDS[chord] || []} />
          </motion.div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button className="btn" onClick={() => setPlaying(!playing)}>
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        {!recording ? (
          <button className="btn record" onClick={startRecording}>● Record</button>
        ) : (
          <button className="btn stop" onClick={stopRecording}>■ Stop</button>
        )}
        {/* {!recording && recordingsList.length > 0 && (
          <button className="btn" onClick={downloadAllWavs}>📥 Download all WAVs</button>
        )} */}
        {recording && <span style={{ marginLeft: 8, color: "red" }}>● Recording {sequence[current]}</span>}
      </div> 
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
            {sequence.map((chord, i) => {
              const isActive = soloIndex !== null ? (i === soloIndex && current === 0) : i === current;
              return (
                <div
                  key={i}
                  className={`sequence-item ${isActive ? "active" : ""} ${i === soloIndex ? "solo" : ""}`}
                  onClick={() => setSoloIndex(i === soloIndex ? null : i)}
                >
                  <ChordDiagram chordName={chord} positions={CHORDS[chord]} small={true} />
                  <span>{chord}</span>
                  <button className="remove-btn" onClick={(e) => { e.stopPropagation(); removeChord(i); }}>✕</button>
                </div>
              );
            })}
            </div>

          {recordingsList.length > 0 && (
            <div className="recordings-list">
              <label className="label">Recordings</label>
              <ul>
                {recordingsList.map((r, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span>
                      {r.name} ({Math.round(r.size / 1000)} KB)
                    </span>
                    <button className="btn" onClick={() => downloadWavFile(i)}>Download WAV</button>
                    <button
                      className="btn"
                      onClick={() => playRecording(i)}
                    >Play</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

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