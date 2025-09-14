import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

interface FFTWaveViewProps {
  data: { x: number, y: number }[];
}

interface Marker {
  x: number;
  y: number;
  stuck: boolean;
}

type Bucket = { frequency: number; amplitude: number; count: number } | null;

const FFTWaveView: React.FC<FFTWaveViewProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [markers, setMarkers] = useState<Marker[]>([]);
  const [size, setSize] = useState({ width: 800, height: 400 });
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };

  // drag refs
  const draggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);

  // Responsive sizing
  useEffect(() => {
    const updateSize = () => {
      const w = containerRef.current?.clientWidth ?? 800;
      const h = Math.max(200, Math.floor((w / 800) * 400));
      setSize({ width: w, height: h });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Aggregate data to one value per horizontal pixel to avoid drawing many rects
  const aggregated = useMemo(() => {
    const w = Math.max(1, size.width - margin.left - margin.right);
    if (!data || data.length === 0) return { buckets: [] as Bucket[], xDomain: [0, 1] as [number, number] };
    const total = data.length;
    const buckets: Bucket[] = new Array(w).fill(null).map(() => ({ frequency: 0, amplitude: 0, count: 0 } as Bucket));
    for (let i = 0; i < total; i++) {
      const point = data[i];
      const denom = (data[data.length - 1].x - data[0].x) || 1;
      const bx = Math.floor(((point.x - data[0].x) / denom) * (w - 1));
      const idx = Math.max(0, Math.min(w - 1, Number.isFinite(bx) ? bx : 0));
      const b = buckets[idx] as Bucket;
      if (b) {
        b.frequency = b.frequency + point.x;
        b.amplitude = Math.max(b.amplitude, point.y);
        b.count += 1;
      }
    }
    // finalize averages where count > 0
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b && b.count > 0) buckets[i] = { frequency: b.frequency / b.count, amplitude: b.amplitude, count: b.count };
    }
    const xDomain: [number, number] = [data[0].x, data[data.length - 1].x];
    return { buckets, xDomain };
  }, [data, size.width, margin.left, margin.right]);

  const calculateNoiseLevel = useMemo(() => {
    const amps = data.length ? data.map(d => d.y) : [];
    if (!amps.length) return 0;
    const sorted = amps.slice().sort((a, b) => a - b);
    const lower = Math.max(1, Math.floor(sorted.length * 0.2));
    const slice = sorted.slice(0, lower);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  }, [data]);

  const formatValue = (value: number, noiseLevel: number) => {
    const decimalPlaces = noiseLevel < 0.001 ? 6 : noiseLevel < 0.01 ? 4 : noiseLevel < 0.1 ? 3 : 2;
    return value.toFixed(decimalPlaces);
  };

  // helper typeguard and utilities
  const isBucket = (b: Bucket): b is { frequency: number; amplitude: number; count: number } => b !== null;
  const getYMax = useCallback(() => {
    const vals = aggregated.buckets.filter(isBucket).map(b => b.amplitude);
    if (vals.length === 0) return 1;
    return Math.max(1e-8, ...vals);
  }, [aggregated]);

  // Draw aggregated bars to canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!canvas || !svg) return;

    const dpr = window.devicePixelRatio || 1;
    const width = size.width;
    const height = size.height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const yMax = getYMax();
    const yScale = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]);

    const barW = Math.max(1, (width - margin.left - margin.right) / Math.max(1, aggregated.buckets.length));

    // gradient fill
    const grad = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(1, '#0066ff');

    ctx.fillStyle = grad;

    for (let i = 0; i < aggregated.buckets.length; i++) {
      const b = aggregated.buckets[i];
      if (!isBucket(b) || b.count === 0) continue;
      const x = margin.left + i * barW;
      const y = yScale(b.amplitude);
      const h = Math.max(0, height - margin.bottom - y);
      ctx.fillRect(x - barW / 2, y, Math.max(1, barW), h);
    }
  }, [aggregated, size, margin.left, margin.right, margin.top, margin.bottom, getYMax]);

  // Draw axes and overlay elements in SVG when dimensions or data change (less frequent)
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', size.width).attr('height', size.height);

    const x = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
    const yMax = getYMax();
    const y = d3.scaleLinear().domain([0, yMax]).range([size.height - margin.bottom, margin.top]);

    const axisStyle = (selection: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      selection.selectAll('path, line').attr('stroke', 'white');
      selection.selectAll('text').attr('fill', 'white').attr('font-size', '12px');
    }

    const xAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(0,${size.height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(d3.format('~s'))).call(axisStyle);
    const yAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y)).call(axisStyle);

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('x', size.width / 2 + margin.left)
      .attr('y', size.height - margin.bottom / 2)
      .text('Frequency (Hz)')
      .attr('fill', 'white');

    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('x', -size.height / 2 + margin.top)
      .attr('y', margin.left / 2)
      .attr('transform', 'rotate(-90)')
      .text('Amplitude')
      .attr('fill', 'white');

    // overlay group for cursor and markers
    svg.append('g').attr('class', 'overlay');

    // initial draw of markers (they will be updated on interactions)
    markers.forEach((marker, index) => {
      const g = svg.append('g').attr('class', `marker-${index}`)
        .attr('transform', `translate(${x(marker.x)},0)`);
      g.append('line')
        .attr('class', 'cursor-line')
        .attr('y1', margin.top)
        .attr('y2', size.height - margin.bottom)
        .attr('stroke', 'red')
        .attr('stroke-width', 1);
      g.append('circle')
        .attr('class', 'cursor-marker')
        .attr('r', 5)
        .attr('fill', 'red')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('cy', y(marker.y));
      g.append('text')
        .attr('class', 'cursor-text')
        .attr('fill', 'black')
        .attr('text-anchor', 'start')
        .attr('x', 10)
        .attr('y', y(marker.y))
        .attr('dy', '-0.5em')
        .text(`Freq: ${formatValue(marker.x, calculateNoiseLevel)} Hz, Amp: ${formatValue(marker.y, calculateNoiseLevel)}`);
    });

    // draw canvas after axes set up
    drawCanvas();
  }, [size, aggregated, markers, drawCanvas, calculateNoiseLevel, margin.left, margin.right, margin.top, margin.bottom, getYMax]);

  // redraw canvas when aggregated data changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // throttled mousemove using rAF + click/drag interactions for markers
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    let scheduled = false;

    const getScales = () => {
      const xScale = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
      const yMaxLocal = getYMax();
      const yScale = d3.scaleLinear().domain([0, yMaxLocal]).range([size.height - margin.bottom, margin.top]);
      return { xScale, yScale };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (scheduled) return;
      scheduled = true;
      const ev = event;
      rafRef.current = window.requestAnimationFrame(() => {
        scheduled = false;
        const [mx] = d3.pointer(ev as unknown as PointerEvent, svgEl as Element);
        const { xScale } = getScales();
        const xValue = xScale.invert(mx);
        // find closest aggregated bucket
        const w = Math.max(1, aggregated.buckets.length);
        const rel = (xValue - aggregated.xDomain[0]) / (aggregated.xDomain[1] - aggregated.xDomain[0] || 1);
        const idx = Math.max(0, Math.min(w - 1, Math.floor(rel * w)));
        const point = aggregated.buckets[idx];
        const overlay = d3.select(svgEl).select('g.overlay');
        overlay.selectAll('*').remove();
        if (isBucket(point) && point.count > 0) {
          const cx = margin.left + idx * ((size.width - margin.left - margin.right) / w);
          // line
          overlay.append('line')
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', margin.top)
            .attr('y2', size.height - margin.bottom)
            .attr('stroke', 'red')
            .attr('stroke-width', 1);
          // marker
          const yMaxLocal2 = getYMax();
          const yScaleLocal = d3.scaleLinear().domain([0, yMaxLocal2]).range([size.height - margin.bottom, margin.top]);
          overlay.append('circle')
            .attr('cx', cx)
            .attr('cy', yScaleLocal(point.amplitude))
            .attr('r', 5)
            .attr('fill', '#ff4081')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

          overlay.append('text')
            .attr('x', cx + 10)
            .attr('y', yScaleLocal(point.amplitude))
            .attr('fill', 'white')
            .text(`Freq: ${formatValue(point.frequency, calculateNoiseLevel)} Hz, Amp: ${formatValue(point.amplitude, calculateNoiseLevel)}`);
        }

        // if dragging, update marker position
        if (draggingRef.current && dragIndexRef.current !== null) {
          const dragIdx = dragIndexRef.current;
          const w2 = Math.max(1, aggregated.buckets.length);
          const rel2 = Math.max(0, Math.min(1, (mx - margin.left) / (size.width - margin.left - margin.right)));
          const bucketIndex = Math.floor(rel2 * w2);
          const b = aggregated.buckets[bucketIndex];
          if (isBucket(b) && b.count > 0) {
            setMarkers(prev => {
              const next = prev.slice();
              if (next[dragIdx]) {
                next[dragIdx] = { x: b.frequency, y: b.amplitude, stuck: next[dragIdx].stuck };
              }
              return next;
            });
          }
        }
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const ev = event;
      const [mx] = d3.pointer(ev as unknown as PointerEvent, svgEl as Element);
      const { xScale } = getScales();

      // check if we clicked near an existing marker (within 10px)
      const markersPx = markers.map(mk => ({ px: xScale(mk.x), mk }));
      const nearest = markersPx.reduce((acc, cur, i) => {
        const dist = Math.abs(cur.px - mx);
        if (dist < (acc.dist ?? Infinity)) return { dist, i };
        return acc;
      }, {} as { dist?: number; i?: number });
      if (nearest && nearest.dist !== undefined && nearest.dist < 12 && nearest.i !== undefined) {
        // start dragging that marker
        draggingRef.current = true;
        dragIndexRef.current = nearest.i;
      }
    };

    const handlePointerUp = () => {
      draggingRef.current = false;
      dragIndexRef.current = null;
    };

    const handleClick = (event: MouseEvent) => {
      // add marker at click position
      const [mx] = d3.pointer(event as unknown as PointerEvent, svgEl as Element);
      const xScale = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
      const xValue = xScale.invert(mx);
      const w = Math.max(1, aggregated.buckets.length);
      const rel = (xValue - aggregated.xDomain[0]) / (aggregated.xDomain[1] - aggregated.xDomain[0] || 1);
      const idx = Math.max(0, Math.min(w - 1, Math.floor(rel * w)));
      const b = aggregated.buckets[idx];
      if (isBucket(b) && b.count > 0) {
        setMarkers(prev => [...prev, { x: b.frequency, y: b.amplitude, stuck: false }]);
      }
    };

    const handleDblClick = (event: MouseEvent) => {
      const [mx] = d3.pointer(event as unknown as PointerEvent, svgEl as Element);
      const xScale = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
      // remove nearest marker within threshold
      let nearestIdx: number | null = null;
      let nearestDist = Infinity;
      markers.forEach((mk, i) => {
        const px = xScale(mk.x);
        const dist = Math.abs(px - mx);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      });
      if (nearestIdx !== null && nearestDist < 12) {
        setMarkers(prev => prev.filter((_, i) => i !== nearestIdx));
      }
    };

    svgEl.addEventListener('pointermove', handlePointerMove as EventListener);
    svgEl.addEventListener('pointerdown', handlePointerDown as EventListener);
    window.addEventListener('pointerup', handlePointerUp as EventListener);
    svgEl.addEventListener('click', handleClick as EventListener);
    svgEl.addEventListener('dblclick', handleDblClick as EventListener);

    return () => {
      svgEl.removeEventListener('pointermove', handlePointerMove as EventListener);
      svgEl.removeEventListener('pointerdown', handlePointerDown as EventListener);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);
      svgEl.removeEventListener('click', handleClick as EventListener);
      svgEl.removeEventListener('dblclick', handleDblClick as EventListener);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [aggregated, size, calculateNoiseLevel, markers, margin.left, margin.right, margin.top, margin.bottom, getYMax]);

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} style={{ width: '100%', height: size.height }} />
      <svg ref={svgRef} style={{ position: 'relative', top: -size.height, pointerEvents: 'auto' }} />
      <div className="noise-info" style={{ marginTop: size.height + 8 }}>
        <small>Noise Level: {formatValue(calculateNoiseLevel, calculateNoiseLevel)}</small>
        <br />
        <small>Samples: {data.length}</small>
      </div>
    </div>
  );
};

export default FFTWaveView;
