"use client";

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface WaveViewProps {
  data: { x: number, y: number }[];
}

const WaveView: React.FC<WaveViewProps> = ({ data }) => {
  const ref = useRef<SVGSVGElement | null>(null);

  console.log('data', data)
  useEffect(() => {
    if (!ref.current) return;

    const svg = d3.select(ref.current);
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    svg.attr('width', width).attr('height', height);

    // Determine the domain for x and y scales based on the data
    const xDomain = d3.extent(data, d => d.x) as [number, number];
    const yDomain = d3.extent(data, d => d.y) as [number, number];

    // Create the scales with the dynamic domain
    const x = d3.scaleLinear().domain(xDomain).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain(yDomain).range([height - margin.bottom, margin.top]);

    const xAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
    
    const yAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.selectAll('*').remove(); // Clear previous elements

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    const line = d3.line<{ x: number, y: number }>()
      .x(d => x(d.x))
      .y(d => y(d.y));

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 2)
      .attr('d', line);
  }, [data]);

  return <svg ref={ref}></svg>;
};

export default WaveView;
