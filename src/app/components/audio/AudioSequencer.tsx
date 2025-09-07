// AudioSequencer.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AudioClip } from '@/app/types/types';

type PlayingSource = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

const TRACK_HEIGHT = 80;
const RULER_HEIGHT = 26;
const SVG_HEIGHT = RULER_HEIGHT + TRACK_HEIGHT + 20;
const INITIAL_PX_PER_SEC = 120;
const MIN_PX_PER_SEC = 40;
const MAX_PX_PER_SEC = 300;
const SNAP_SECONDS = 0.25; // snap to 16th notes at 60 bpm (adjust as needed)

const CHORDS = ['C', 'G', 'Em', 'D'];

// Utility: consistent colors per chord
const chordColor = (chord: string) => {
  const scale = d3.scaleOrdinal<string, string>()
    .domain(CHORDS)
    .range(['#5B8DEF', '#52C41A', '#FA8C16', '#EB5757', '#8B5CF6', '#00B8D9', '#F2C94C', '#2D9CDB']);
  return scale(chord) ?? '#4CAF50';
};

// Utility: UUID-ish id
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Compute simple peak envelope for waveform preview.
 * Produces approximately `samplesPerSecond` peak samples per second.
 */
function computePeaks(buffer: AudioBuffer, samplesPerSecond = 100): Float32Array {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

  const blockSize = Math.max(1, Math.floor(buffer.sampleRate / samplesPerSecond));
  const numBlocks = Math.ceil(buffer.length / blockSize);
  const peaks = new Float32Array(numBlocks);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, buffer.length);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const a0 = Math.abs(ch0[j] || 0);
      const a1 = ch1 ? Math.abs(ch1[j] || 0) : 0;
      const a = ch1 ? 0.5 * (a0 + a1) : a0;
      if (a > peak) peak = a;
    }
    peaks[i] = peak;
  }
  return peaks;
}

/**
 * Encode an AudioBuffer as a 16-bit PCM WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;

  const interleaved = new Float32Array(numFrames * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    interleaved.set(buffer.getChannelData(ch), ch);
  }

  // Interleave channels (LRLR...)
  const out = new Float32Array(numFrames * numChannels);
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      out[i * numChannels + ch] = buffer.getChannelData(ch)[i];
    }
  }

  // Convert to 16-bit PCM
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = out.length * bytesPerSample;

  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const view = new DataView(new ArrayBuffer(totalSize));

  let offset = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  };
  const writeUint32 = (v: number) => { view.setUint32(offset, v, true); offset += 4; };
  const writeUint16 = (v: number) => { view.setUint16(offset, v, true); offset += 2; };

  writeString('RIFF');
  writeUint32(totalSize - 8);
  writeString('WAVE');

  writeString('fmt ');
  writeUint32(16);            // PCM header size
  writeUint16(1);             // format = PCM
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(16);            // bits per sample

  writeString('data');
  writeUint32(dataSize);

  // PCM samples
  for (let i = 0; i < out.length; i++) {
    const s = Math.max(-1, Math.min(1, out[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view.buffer], { type: 'audio/wav' });
}

type AudioSequencerProps = {
  // Optional external clip passed in from parent; when provided and "Add" is pressed it will be appended.
  externalClip?: AudioClip | null;
  // Optional callback invoked when a clip is selected (or null when deselected).
  onSequenceSelected?: (clip: AudioClip | null) => void;
};

const AudioSequencer: React.FC<AudioSequencerProps> = ({ externalClip = null, onSequenceSelected }) => {
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [selectedChord, setSelectedChord] = useState<string | AudioClip>(CHORDS[0]);
  const [pxPerSec, setPxPerSec] = useState<number>(INITIAL_PX_PER_SEC);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursorTime, setCursorTime] = useState(0); // seconds
  const [snap, setSnap] = useState(SNAP_SECONDS);

  // Selected clip id (null = none)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0); // audioCtx.currentTime when started
  const cursorAtStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const playingRef = useRef<PlayingSource[]>([]);

  const basePath = process.env.basePath || '';

  const projectDuration = useMemo(() => {
    let maxEnd = 4; // minimum 4 seconds view
    clips.forEach(c => {
      maxEnd = Math.max(maxEnd, c.start + c.duration + 1);
    });
    return maxEnd;
  }, [clips]);

  const contentWidth = useMemo(() => Math.ceil(projectDuration * pxPerSec), [projectDuration, pxPerSec]);

  const handleRecordToggle = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();

          const audioCtx = audioCtxRef.current ?? new AudioContext();
          audioCtxRef.current = audioCtx;

          const buffer = await audioCtx.decodeAudioData(arrayBuffer);
          const peaks = computePeaks(buffer, 120);

          const newClip: AudioClip = {
            id: uid(),
            chord: 'Mic',
            start: 0,
            duration: buffer.duration,
            buffer,
            peaks,
            color: '#FF6B6B',
          };

          setClips(prev => [...prev, newClip]);
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        alert('Microphone access denied or unavailable.');
        console.log('Microphone error', err);
      }
    }
  };

  async function loadClip(chord: string): Promise<AudioClip> {
    const url = `${basePath}/data/guitar/chords/${chord}.m4a`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const arrayBuffer = await res.arrayBuffer();

    const audioCtx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = audioCtx;

    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    const peaks = computePeaks(buffer, 120); // 120 samples/sec for a smooth preview
    return {
      id: uid(),
      chord,
      start: 0,
      duration: buffer.duration,
      buffer,
      peaks,
      color: chordColor(chord),
    };
  }

  const addClip = async () => {
    // If the current selection is an AudioClip object, clone & append it
    if (typeof selectedChord !== 'string') {
      const clipObj: AudioClip = selectedChord;
      const cloned: AudioClip = {
        ...clipObj,
        id: clipObj.id ?? uid(),
        color: clipObj.color ?? chordColor(clipObj.chord ?? 'ext'),
      };
      if (!cloned.peaks && cloned.buffer) {
        try {
          cloned.peaks = computePeaks(cloned.buffer, 120);
        } catch {
          // ignore
        }
      }
      setClips(prev => [...prev, cloned]);
      return;
    }

    // Defensive: if somehow the string equals our external marker and externalClip exists
    if (selectedChord === '__external__' && externalClip) {
      const cloned: AudioClip = {
        ...externalClip,
        id: externalClip.id ?? uid(),
        color: externalClip.color ?? chordColor(externalClip.chord ?? 'ext'),
      };
      if (!cloned.peaks && cloned.buffer) {
        try {
          cloned.peaks = computePeaks(cloned.buffer, 120);
        } catch {
          // ignore
        }
      }
      setClips(prev => [...prev, cloned]);
      return;
    }

    // Otherwise treat selectedChord as the chord name string and load it
    const clip = await loadClip(selectedChord);
    setClips(prev => [...prev, clip]);
  };

  // Playback scheduling from a given start time (cursor)
  const playFrom = (startAtTime: number) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;

    // Clear previous
    stopPlayback();

    const now = audioCtx.currentTime;
    startedAtRef.current = now;
    cursorAtStartRef.current = startAtTime;

    const active: PlayingSource[] = [];

    for (const clip of clips) {
      if (!clip.buffer) continue;
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;

      if (startAtTime >= clipEnd) continue; // already past this clip

      const offset = Math.max(0, startAtTime - clipStart); // where to start in the clip
      const when = now + Math.max(0, clipStart - startAtTime); // when to schedule relative to now
      const duration = clip.duration - offset;
      if (duration <= 0) continue;

      const source = audioCtx.createBufferSource();
      source.buffer = clip.buffer;

      const gain = audioCtx.createGain();
      gain.gain.value = 1.0; // could be user-controlled per-clip later

      source.connect(gain);
      gain.connect(audioCtx.destination);

      try {
        source.start(when, offset, duration);
      } catch {
        // ignore
      }

      active.push({ source, gain });
    }

    playingRef.current = active;
    setIsPlaying(true);
    animatePlayhead();
  };

  const pausePlayback = () => {
    // Compute new cursor based on elapsed
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;
    const elapsed = audioCtx.currentTime - startedAtRef.current;
    const newCursor = cursorAtStartRef.current + elapsed;
    setCursorTime(Math.min(newCursor, projectDuration));
    // Stop sources
    for (const p of playingRef.current) {
      try { p.source.stop(); } catch { /* noop */ }
    }
    playingRef.current = [];
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const stopPlayback = () => {
    for (const p of playingRef.current) {
      try { p.source.stop(); } catch { /* noop */ }
    }
    playingRef.current = [];
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      playFrom(cursorTime);
    }
  };

  const handleStop = () => {
    stopPlayback();
    setCursorTime(0);
  };

  const animatePlayhead = () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;
    const tick = () => {
      const elapsed = audioCtx.currentTime - startedAtRef.current;
      const pos = cursorAtStartRef.current + elapsed;
      setCursorTime(Math.min(pos, projectDuration));
      // stop automatically when past project end
      if (pos >= projectDuration) {
        stopPlayback();
        setCursorTime(projectDuration);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Offline render and download as WAV
  const handleDownload = async () => {
    if (clips.length === 0) return;
    const sampleRate = 44100;
    const length = Math.ceil(projectDuration * sampleRate);
    const offline = new OfflineAudioContext(2, length, sampleRate);

    for (const clip of clips) {
      if (!clip.buffer) continue;
      const src = offline.createBufferSource();
      src.buffer = clip.buffer;

      const gain = offline.createGain();
      gain.gain.value = 1.0;

      src.connect(gain).connect(offline.destination);

      // schedule from project start
      try {
        src.start(clip.start, 0);
      } catch {
        // ignore
      }
    }

    const rendered = await offline.startRendering();
    const blob = audioBufferToWavBlob(rendered);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mixdown.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // D3 rendering
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    // Clear selection when re-rendering if the selected clip no longer exists
    if (selectedClipId && !clips.find(c => c.id === selectedClipId)) {
      setSelectedClipId(null);
      onSequenceSelected?.(null);
      //window.dispatchEvent(new CustomEvent('audio-sequencer:select', { detail: null }));
    }

    // Ensure svg width grows with content; wrap container scrolls
    svg.attr('width', contentWidth).attr('height', SVG_HEIGHT);

    // Background
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', contentWidth)
      .attr('height', SVG_HEIGHT)
      .attr('fill', '#0B0E14');

    // Time scale
    const xScale = d3.scaleLinear().domain([0, projectDuration]).range([0, contentWidth]);

    // Grid lines and ruler ticks
    const grid = svg.append('g').attr('transform', `translate(0, ${RULER_HEIGHT})`);
    const seconds = d3.range(0, Math.ceil(projectDuration) + 1, 1);
    grid.selectAll('line.sec')
      .data(seconds)
      .enter()
      .append('line')
      .attr('class', 'sec')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', TRACK_HEIGHT + 10)
      .attr('stroke', '#1E2430')
      .attr('stroke-width', 1);

    // Sub-grid for snapping
    const subs = d3.range(0, projectDuration + snap, snap);
    grid.selectAll('line.sub')
      .data(subs)
      .enter()
      .append('line')
      .attr('class', 'sub')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', TRACK_HEIGHT + 10)
      .attr('stroke', '#151A24')
      .attr('stroke-width', 1);

    // Ruler labels (top)
    const axis = d3.axisTop(xScale)
      .ticks(Math.max(4, Math.floor(contentWidth / 120)))
      .tickFormat(d => `${d}s`) as d3.Axis<number>;

    svg.append('g')
      .attr('transform', `translate(0, ${RULER_HEIGHT})`)
      .call(axis)
      .selectAll('text')
      .style('fill', '#A6B1C2');

    svg.selectAll('.domain, .tick line').attr('stroke', 'var(--primary-button)');

    // Seek interaction on background
    svg.on('mousedown', (event: MouseEvent) => {
      const pt = d3.pointer(event);
      const x = Math.max(0, Math.min(contentWidth, pt[0]));
        // Seek by clicking on the ruler/track. Also deselect when clicking background.
      const handleSeek = (x: number) => {
        const t = x / pxPerSec;
        setCursorTime(t);
        // Deselect any clip when clicking background
        setSelectedClipId(null);
        onSequenceSelected?.(null);
        //window.dispatchEvent(new CustomEvent('audio-sequencer:select', { detail: null }));
        onSequenceSelected?.(null);
        if (isPlaying) {
          playFrom(t);
        }
      };
      handleSeek(x);
    });

    // Clips layer
    const clipsLayer = svg.append('g').attr('transform', `translate(0, ${RULER_HEIGHT + 6})`);

    const clipGroups = clipsLayer
      .selectAll<SVGGElement, AudioClip>('g.clip')
      .data(clips, (d) => d.id)
      .join(enter => {
        const g = enter.append('g').attr('class', 'clip').style('cursor', 'grab');

        // Background rounded rect
        g.append('rect')
          .attr('class', 'bg')
          .attr('rx', 6)
          .attr('ry', 6)
          .attr('height', TRACK_HEIGHT - 12)
          .attr('stroke', '#11151F')
          .attr('stroke-width', 1.5);

        // Waveform path (filled symmetric area)
        g.append('path')
          .attr('class', 'wave')
          .attr('fill-opacity', 0.8);

        // Label
        g.append('text')
          .attr('class', 'label')
          .attr('fill', '#E6EDF7')
          .attr('font-weight', 600)
          .attr('font-size', 12);

        return g;
      });

    // Position and size per clip
    clipGroups.each(function (clip: AudioClip) {
      //const g = d3.select(this);
      const g: d3.Selection<SVGGElement, AudioClip, null, undefined> = d3.select(this)
      const x = xScale(clip.start);
      const w = Math.max(24, clip.duration * pxPerSec);
      const y = 6;
      const h = TRACK_HEIGHT - 12;

      g.attr('transform', `translate(${x}, ${y})`);

      // Visual style: highlight if selected
      const isSelected = clip.id === selectedClipId;
      g.select<SVGRectElement>('rect.bg')
        .attr('width', w)
        .attr('fill', d3.color(clip.color)!.darker(0.3).formatHex())
        .attr('stroke', isSelected ? '#FFD166' : '#11151F')
        .attr('stroke-width', isSelected ? 2.5 : 1.5);

      // Waveform area
      const peaks = clip.peaks ?? new Float32Array(0);
      if (peaks.length > 0) {
        const centerY = h / 2;
        const xScaleLocal = d3.scaleLinear().domain([0, peaks.length - 1]).range([0, w]);
        const yScaleLocal = d3.scaleLinear().domain([0, 1]).range([0, centerY]);

        // Build symmetric polygon path (top + mirrored bottom)
        const top: [number, number][] = [];
        for (let i = 0; i < peaks.length; i++) {
          top.push([xScaleLocal(i), centerY - yScaleLocal(peaks[i])]);
        }
        const bottom: [number, number][] = [];
        for (let i = peaks.length - 1; i >= 0; i--) {
          bottom.push([xScaleLocal(i), centerY + yScaleLocal(peaks[i])]);
        }
        const poly = d3.path();
        const first = top[0] ?? [0, centerY];
        poly.moveTo(first[0], first[1]);
        for (let i = 1; i < top.length; i++) poly.lineTo(top[i][0], top[i][1]);
        for (let i = 0; i < bottom.length; i++) poly.lineTo(bottom[i][0], bottom[i][1]);
        poly.closePath();

        g.select<SVGPathElement>('path.wave')
          .attr('d', poly.toString())
          .attr('fill', d3.color(clip.color)!.brighter(0.2).formatHex());
      } else {
        g.select<SVGPathElement>('path.wave').attr('d', '').attr('fill', clip.color);
      }

      g.select<SVGTextElement>('text.label')
        .attr('x', 10)
        .attr('y', 18)
        .text(`${clip.chord} • ${clip.duration.toFixed(2)}s`);

      // Drag behavior
      
      g.call(
        d3.drag<SVGGElement, AudioClip>()
          .on('start', function () {
            d3.select(this).style('cursor', 'grabbing');
          })
          .on('drag', function (event) {
            const dx = Math.max(0, Math.min(contentWidth - w, event.x));
            const snapped = snap > 0 ? Math.round((dx / pxPerSec) / snap) * snap * pxPerSec : dx;
            d3.select(this).attr('transform', `translate(${snapped}, ${y})`);
          })
          .on('end', (event, d) => {
            const dx = Math.max(0, Math.min(contentWidth - w, event.x));
            const t = dx / pxPerSec;
            const snappedT = snap > 0 ? Math.max(0, Math.round(t / snap) * snap) : Math.max(0, t);
            setClips(prev => prev.map(c => (c.id === d.id ? { ...c, start: snappedT } : c)));
          })
      );

      // Selection: click a clip to select it and notify consumers.
      g.on('click', (event: MouseEvent, d: AudioClip) => {
        // Prevent background handler from firing (which would deselect)
        event.stopPropagation();
        setSelectedClipId(d.id);
        onSequenceSelected?.(d);
        //window.dispatchEvent(new CustomEvent('audio-sequencer:select', { detail: d }));
      });
    });

    // Playhead
    const playX = xScale(cursorTime);
    svg.append('line')
      .attr('x1', playX)
      .attr('x2', playX)
      .attr('y1', 0)
      .attr('y2', SVG_HEIGHT)
      .attr('stroke', '#FF4D4F')
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');

  }, [clips, pxPerSec, contentWidth, projectDuration, cursorTime, snap, selectedClipId, isPlaying, onSequenceSelected]);

  // Resize: make container horizontally scrollable to contentWidth
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollLeft = Math.max(0, (cursorTime * pxPerSec) - 100);
  }, [cursorTime, pxPerSec]);

  const selectedChordValue = typeof selectedChord === 'string' ? selectedChord : '__external__';

  return (
    <div style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system', color: '#E6EDF7' }}>
      <div style={{ padding: '12px 16px', background: '#0B0E14', borderBottom: '1px solid #11151F', position: 'sticky', top: 0, zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handlePlayPause}
            style={{ background: 'var(--primary-button)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
            title="Play/Pause"
          >
            {isPlaying ? '⏸ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={handleStop}
            style={{ background: 'var(--primary-button)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
            title="Stop"
          >
            ⏹ Stop
          </button>

          <button
            onClick={handleRecordToggle}
            style={{
              background: isRecording ? '#FF4D4F' : 'var(--primary-button)',
              color: 'white',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
            title="Record from microphone"
          >
            {isRecording ? '⏹ Stop Recording' : '🎙 Record'}
          </button>

          <div style={{ width: 1, height: 24, background: '#1E2430', margin: '0 4px' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#A6B1C2' }}>Zoom</span>
            <input
              type="range"
              min={MIN_PX_PER_SEC}
              max={MAX_PX_PER_SEC}
              value={pxPerSec}
              onChange={(e) => setPxPerSec(parseInt(e.target.value, 10))}
            />
            <span style={{ color: '#A6B1C2', fontVariantNumeric: 'tabular-nums' }}>{pxPerSec}px/s</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#A6B1C2' }}>Snap</span>
            <select
              value={snap}
              onChange={(e) => setSnap(parseFloat(e.target.value))}
              style={{ background: '#0F131C', color: '#E6EDF7', border: '1px solid #1E2430', borderRadius: 6, padding: '6px 8px' }}
            >
              <option value={0}>Off</option>
              <option value={0.125}>1/8 s</option>
              <option value={0.25}>1/4 s</option>
              <option value={0.5}>1/2 s</option>
              <option value={1}>1 s</option>
            </select>
          </label>

          <div style={{ width: 1, height: 24, background: '#1E2430', margin: '0 4px' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#A6B1C2' }}>Add clip</span>
            <select
              value={selectedChordValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__external__') {
                  if (externalClip) setSelectedChord(externalClip);
                } else {
                  setSelectedChord(v);
                }
              }}
              style={{ background: '#0F131C', color: '#E6EDF7', border: '1px solid #1E2430', borderRadius: 6, padding: '6px 8px' }}
            >
              {CHORDS.map(c => <option key={c} value={c}>{c}</option>)}
              {externalClip && <option key="__external__" value="__external__">External: {externalClip.chord ?? 'Clip'}</option>}
            </select>
            <button
              onClick={addClip}
              style={{ background: '#3A4256', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
            >
              ➕ Add
            </button>
          </label>

          <div style={{ marginLeft: 'auto' }} />

          <button
            onClick={handleDownload}
            style={{ background: '#4C566A', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
            title="Download WAV"
          >
            ⬇️ Export WAV
          </button>

          <div style={{ color: '#A6B1C2', marginLeft: 8 }}>
            Cursor: {cursorTime.toFixed(2)}s • Duration: {projectDuration.toFixed(2)}s
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ overflowX: 'auto', background: '#0B0E14', borderTop: '1px solid #11151F' }}
      >
        <svg ref={svgRef} />
      </div>
    </div>
  );
};

export default AudioSequencer;
