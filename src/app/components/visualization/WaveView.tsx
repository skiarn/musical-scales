import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { applyHanningWindow, vibrationToVelocityRMS } from '@/app/utils/signal-processing';

export type FuncTransform<T extends { x: number; y: number }> = (input: T[]) => T[];

export type FuncZoom<T extends { x: number; y: number }> = (input: T[], from: number, to: number) => T[];
export type FuncFilter<T extends { x: number; y: number }> = (input: T[]) => T[];

interface WaveViewProps {
  data: { x: number, y: number }[];
  options?: {
    width?: number;
    height?: number;
    filter?: {
      windows: string[]; // Changed to array of strings
    };
  };
  onTransform: (transformation: string, enabled: boolean, funcTransform: FuncTransform<{ x: number, y: number }>) => void;
  onZoom: (reset: boolean, from: number, to: number, funcZoom: FuncZoom<{ x: number; y: number }>) => void;
  onFilter: (window: string, enabled: boolean, funcWindow: FuncFilter<{ x: number; y: number }>) => void;
}

function zoomImpl(input: { x: number, y: number }[],
  from: number,
  to: number): { x: number, y: number }[] {
  return input.filter(d => d.x >= from && d.x <= to);
}

const WaveView: React.FC<WaveViewProps> = ({ data, options, onFilter, onZoom, onTransform }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // dimensions
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const defaultWidth = options?.width ?? 800;
  const defaultHeight = options?.height ?? 300;
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });

  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? defaultWidth;
      const h = Math.max(180, Math.floor((w / defaultWidth) * defaultHeight));
      setSize({ width: w, height: h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [defaultWidth, defaultHeight]);

  type Bucket = { x: number; yMax: number; yMin: number } | null;
  const isBucket = useCallback((b: Bucket): b is { x: number; yMax: number; yMin: number } => b !== null, []);

  // Aggregate data to per-pixel buckets (track both min and max per bucket)
  const aggregated = useMemo(() => {
    const width = Math.max(1, size.width - margin.left - margin.right);
    if (!data || data.length === 0) return { buckets: [] as Bucket[], xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number] };

    const total = data.length;
    const buckets: { xSum: number; yMax: number; yMin: number; count: number }[] = new Array(width).fill(null).map(() => ({ xSum: 0, yMax: -Infinity, yMin: Infinity, count: 0 }));

    const xMin = data[0].x;
    const xMax = data[data.length - 1].x || xMin + 1;

    for (let i = 0; i < total; i++) {
      const p = data[i];
      const pos = Math.floor(((p.x - xMin) / (xMax - xMin || 1)) * (width - 1));
      const idx = Math.max(0, Math.min(width - 1, isFinite(pos) ? pos : 0));
      const b = buckets[idx];
      b.xSum += p.x;
      b.yMax = Math.max(b.yMax, p.y);
      b.yMin = Math.min(b.yMin, p.y);
      b.count += 1;
    }

    const finalized = buckets.map((b) => {
      if (b.count === 0) return null;
      return { x: b.xSum / b.count, yMax: b.yMax, yMin: b.yMin } as Bucket;
    });

    const valid = finalized.filter(isBucket);
    const globalMax = valid.length ? Math.max(...valid.map(v => v.yMax)) : 0;
    const globalMin = valid.length ? Math.min(...valid.map(v => v.yMin)) : 0;
    const maxAbs = Math.max(Math.abs(globalMax), Math.abs(globalMin), 1e-8);

    return { buckets: finalized, xDomain: [xMin, xMax] as [number, number], yDomain: [-maxAbs, maxAbs] as [number, number] };
  }, [data, size.width, margin.left, margin.right, isBucket]);

  // Draw waveform into canvas
  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = size.width;
    const height = size.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const yScale = d3.scaleLinear().domain(aggregated.yDomain).range([height - margin.bottom, margin.top]);

    // Background
    ctx.fillStyle = '#071126';
    ctx.fillRect(0, 0, width, height);

    // draw bars (vertical span from yMax to yMin per bucket)
    const barCount = aggregated.buckets.length;
    if (barCount === 0) return;
    const barW = Math.max(1, (width - margin.left - margin.right) / barCount);

    ctx.fillStyle = '#4FD1C5';
    for (let i = 0; i < barCount; i++) {
      const b = aggregated.buckets[i];
      if (!isBucket(b)) continue;
      const x = margin.left + i * barW;
      const yTop = yScale(b.yMax);
      const yBottom = yScale(b.yMin);
      const h = Math.max(1, yBottom - yTop);
      ctx.fillRect(x - barW / 2, yTop, Math.max(1, barW), h);
    }

    // draw zero line
    const y0 = yScale(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, y0);
    ctx.lineTo(width - margin.right, y0);
    ctx.stroke();
  }, [aggregated, size, margin.left, margin.right, margin.top, margin.bottom, isBucket]);

  // Draw axes and overlay (SVG)
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', size.width).attr('height', size.height).style('overflow', 'visible');

    const x = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
    const y = d3.scaleLinear().domain(aggregated.yDomain).range([size.height - margin.bottom, margin.top]);

    const axisStyle = (selection: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      selection.selectAll('path, line').attr('stroke', 'white');
      selection.selectAll('text').attr('fill', 'white').attr('font-size', '12px');
    };

    const xAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(0,${size.height - margin.bottom})`).call(d3.axisBottom(x)).call(axisStyle);

    const yAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickFormat(d3.format('.2f'))).call(axisStyle);

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('x', size.width / 2 + margin.left)
      .attr('y', size.height - margin.bottom / 2)
      .text('Time')
      .attr('fill', 'white');

    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('x', -size.height / 2 + margin.top)
      .attr('y', margin.left / 2)
      .attr('transform', 'rotate(-90)')
      .text('Amplitude')
      .attr('fill', 'white');

    // add overlay group for interactions
    svg.append('g').attr('class', 'overlay');

    // add brush
    const brush = d3.brushX()
      .extent([[margin.left, margin.top], [size.width - margin.right, size.height - margin.bottom]])
      .on('end', function({ selection }: { selection: [number, number] | null }) {
        if (!selection) return;
        const [x0, x1] = selection.map((d: number) => x.invert(d));
        onZoom(false, x0, x1, zoomImpl);
        const brushGroup = svg.select<SVGGElement>('.brush');
        // call move in a typed way to avoid 'any'
        (brush as unknown as { move: (sel: d3.Selection<SVGGElement, unknown, null, undefined>, v: null) => void }).move(brushGroup, null);
      });

    svg.append('g').attr('class', 'brush').call(brush as d3.BrushBehavior<unknown>);

    // Menu rendering (SVG overlay)
    if (options?.filter?.windows) {
      const expandedMenuWidth = 150;
      const collapsedMenuWidth = 40;
      const menuWidth = isMenuOpen ? expandedMenuWidth : collapsedMenuWidth;
      const itemHeight = 30;
      const menuPadding = 8;
      const headerHeight = itemHeight + (menuPadding * 2);
      const menuItems = [...options.filter.windows, 'Reset Zoom', 'velocity'];
      const menuMargin = 8;

      const defs = svg.append('defs');
      defs.append('filter')
        .attr('id', 'drop-shadow')
        .append('feDropShadow')
        .attr('dx', '0')
        .attr('dy', '1')
        .attr('stdDeviation', '2')
        .attr('flood-opacity', '0.2');

      const filterGroup = svg
        .append('g')
        .attr('class', 'filter-menu')
        .attr('transform', `translate(${size.width - menuWidth - menuMargin}, ${menuMargin})`);

      const toggleButton = filterGroup
        .append('g')
        .attr('transform', `translate(0, 0)`)
        .style('cursor', 'pointer')
        .on('click', () => setIsMenuOpen(!isMenuOpen));

      toggleButton
        .append('rect')
        .attr('width', menuWidth)
        .attr('height', headerHeight)
        .attr('fill', '#ffffff22')
        .attr('rx', 6)
        .attr('ry', 6);

      const iconSize = 18;
      const iconX = menuWidth - iconSize - 10;
      const iconY = (headerHeight - 12) / 2;

      toggleButton
        .selectAll('.menu-line')
        .data<number>([0, 1, 2])
        .enter()
        .append('line')
        .attr('class', 'menu-line')
        .attr('x1', iconX)
        .attr('x2', iconX + iconSize)
        .attr('y1', (d: number) => iconY + (d * 6))
        .attr('y2', (d: number) => iconY + (d * 6))
        .attr('stroke', '#ccc')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round');

      if (isMenuOpen) {
        // divider
        filterGroup
          .append('line')
          .attr('x1', 0)
          .attr('x2', menuWidth)
          .attr('y1', headerHeight)
          .attr('y2', headerHeight)
          .attr('stroke', '#e9ecef')
          .attr('stroke-width', 1);

        menuItems.forEach((item, i) => {
          const yPos = headerHeight + (i * itemHeight);
          const filterItem = filterGroup
            .append('g')
            .attr('transform', `translate(0, ${yPos})`)
            .style('cursor', 'pointer')
            .attr('fill', 'white')
            .on('click', () => {
              if (item === 'Reset Zoom') {
                onZoom(true, 0, 0, zoomImpl);
              } else if (item === 'hanning') {
                const newActiveFilters = new Set(activeFilters);
                if (newActiveFilters.has(item)) {
                  newActiveFilters.delete(item);
                  onFilter(item, false, applyHanningWindow);
                } else {
                  newActiveFilters.add(item);
                  onFilter(item, true, applyHanningWindow);
                }
                setActiveFilters(newActiveFilters);
              } else if (item === 'velocity') {
                const newActiveFilters = new Set(activeFilters);
                if (newActiveFilters.has(item)) {
                  newActiveFilters.delete(item);
                  onTransform(item, false, () => data);
                } else {
                  newActiveFilters.add(item);
                  onTransform(item, true, vibrationToVelocityRMS);
                }
                setActiveFilters(newActiveFilters);
              } else {
                console.warn(`Unknown filter action for item: ${item}`);
              }
            });

          filterItem
            .append('rect')
            .attr('width', menuWidth)
            .attr('height', itemHeight)
            .attr('fill', '#ffffff06')
            .attr('class', 'menu-item-bg');

          if (item !== 'Reset Zoom' && activeFilters.has(item)) {
            filterItem
              .append('circle')
              .attr('cx', menuPadding + 8)
              .attr('cy', itemHeight / 2)
              .attr('r', 3)
              .attr('fill', '#4FD1C5');
          }

          filterItem
            .append('text')
            .attr('x', menuPadding + 20)
            .attr('y', itemHeight / 2 + 5)
            .text(item)
            .attr('fill', item === 'Reset Zoom' ? '#ff6b6b' : '#dbe7f7')
            .style('font-size', '13px');

          filterItem
            .on('mouseenter', function () {
              d3.select(this).select('.menu-item-bg')
                .attr('fill', '#ffffff0f');
            })
            .on('mouseleave', function () {
              d3.select(this).select('.menu-item-bg')
                .attr('fill', '#ffffff06');
            });
        });
      }
    }
  }, [data, aggregated, size, onZoom, options, activeFilters, isMenuOpen, onFilter, onTransform, margin.left, margin.right, margin.top, margin.bottom]);

  // draw canvas when aggregated changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, aggregated, size]);

  // mousemove overlay handling (throttled via rAF) to show cursor and values
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    let scheduled = false;
    const handleMove = (event: MouseEvent) => {
      if (scheduled) return;
      scheduled = true;
      const ev = event as MouseEvent;
      requestAnimationFrame(() => {
        scheduled = false;
        const [mx] = d3.pointer(ev, svgEl as Element) as [number, number];
        const xScale = d3.scaleLinear().domain(aggregated.xDomain).range([margin.left, size.width - margin.right]);
        const yScale = d3.scaleLinear().domain(aggregated.yDomain).range([size.height - margin.bottom, margin.top]);
        const xValue = xScale.invert(mx);
        const w = Math.max(1, aggregated.buckets.length);
        const rel = (xValue - aggregated.xDomain[0]) / (aggregated.xDomain[1] - aggregated.xDomain[0] || 1);
        const idx = Math.max(0, Math.min(w - 1, Math.floor(rel * w)));
        const point = aggregated.buckets[idx];
        const overlay = d3.select(svgEl).select('g.overlay');
        overlay.selectAll('*').remove();
        if (point && isBucket(point)) {
          const cx = margin.left + idx * ((size.width - margin.left - margin.right) / w);
          const cy = yScale((point.yMax + point.yMin) / 2);
          overlay.append('line')
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', margin.top)
            .attr('y2', size.height - margin.bottom)
            .attr('stroke', 'red')
            .attr('stroke-width', 1);
          overlay.append('text')
            .attr('x', cx + 6)
            .attr('y', cy)
            .text(`${xValue.toFixed(3)}, ${((point.yMax + point.yMin) / 2).toFixed(3)}`)
            .attr('fill', 'white');
        }
      });
    };

    svgEl.addEventListener('mousemove', handleMove as EventListener);
    svgEl.addEventListener('mouseleave', () => {
      const overlay = d3.select(svgEl).select('g.overlay');
      overlay.selectAll('*').remove();
    });

    return () => {
      svgEl.removeEventListener('mousemove', handleMove as EventListener);
    };
  }, [aggregated, size, margin.left, margin.right, margin.top, margin.bottom, isBucket]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      <svg ref={svgRef} style={{ position: 'relative', top: -(size.height), pointerEvents: 'all' }} />
    </div>
  );
};

export default React.memo(WaveView);
