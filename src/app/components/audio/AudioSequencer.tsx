import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

type AudioClip = {
  chord: string;
  startTime: number;
  duration: number;
  buffer?: AudioBuffer;
};

const PIXELS_PER_SECOND = 100;
const TRACK_HEIGHT = 60;

const AudioSequencer: React.FC = () => {
  const [clips, setClips] = useState<AudioClip[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const basePath = process.env.basePath || '';

  const loadAudioBuffer = async (chord: string): Promise<AudioBuffer> => {
    const url = `${basePath}/data/guitar/chords/${chord}.m4a`;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = audioCtx;
    return await audioCtx.decodeAudioData(arrayBuffer);
  };

  const addClip = async (chord: string) => {
    const buffer = await loadAudioBuffer(chord);
    const duration = buffer.duration;
    setClips(prev => [...prev, { chord, startTime: 0, duration, buffer }]);
  };

  const updateTimeline = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const clipGroup = svg
      .selectAll('g.clip')
      .data(clips)
      .enter()
      .append('g')
      .attr('class', 'clip')
      .attr('transform', d => `translate(${d.startTime * PIXELS_PER_SECOND}, 20)`)
      .call(
        d3
          .drag<SVGGElement, AudioClip>()
          .on('drag', function (event, d) {
            const newX = Math.max(0, event.x);
            d.startTime = newX / PIXELS_PER_SECOND;
            d3.select(this).attr('transform', `translate(${newX}, 20)`);
          })
          .on('end', () => {
            setClips([...clips]); // trigger re-render
          })
      );

    clipGroup
      .append('rect')
      .attr('width', d => d.duration * PIXELS_PER_SECOND)
      .attr('height', TRACK_HEIGHT)
      .attr('fill', '#4caf50')
      .attr('rx', 4);

    clipGroup
      .append('text')
      .text(d => d.chord)
      .attr('x', 10)
      .attr('y', TRACK_HEIGHT / 2 + 5)
      .attr('fill', 'white');
  };

  useEffect(() => {
    updateTimeline();
  }, [clips]);

  const playCombined = () => {
    const audioCtx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = audioCtx;

    clips.forEach(clip => {
      if (clip.buffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = clip.buffer;
        source.connect(audioCtx.destination);
        source.start(audioCtx.currentTime + clip.startTime);
      }
    });
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>🎶 D3 Audio Sequencer</h2>

      <div>
        {['C', 'G', 'Em', 'D'].map(chord => (
          <button key={chord} onClick={() => addClip(chord)}>
            Add {chord}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        width={1000}
        height={120}
        style={{ border: '1px solid #ccc', marginTop: '1rem', background: '#f9f9f9' }}
      />

      <div style={{ marginTop: '1rem' }}>
        <button onClick={playCombined}>▶️ Play Combined</button>
        <button onClick={() => alert('Download coming soon')}>⬇️ Download Track</button>
      </div>
    </div>
  );
};

export default AudioSequencer;
