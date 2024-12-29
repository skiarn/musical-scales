"use client";

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface FFTWaveViewProps {
  data: { x: number, y: number }[];
}

const FFTWaveView: React.FC<FFTWaveViewProps> = ({ data }) => {
  const ref = useRef<SVGSVGElement | null>(null);

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
      g.attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(d3.format("~s")));
    const yAxis = (g: d3.Selection<SVGGElement, unknown, null, undefined>) =>
      g.attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));

    svg.selectAll('*').remove(); // Clear previous elements

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    const barWidth = (width - margin.left - margin.right) / data.length;

    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.x) - barWidth / 2)
      .attr('y', d => y(d.y))
      .attr('width', barWidth)
      .attr('height', d => height - margin.bottom - y(d.y))
      .attr('fill', 'steelblue');

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("x", width / 2 + margin.left)
      .attr("y", height - margin.bottom / 2)
      .text("Frequency (Hz)");

    svg.append("text")
      .attr("text-anchor", "end")
      .attr("x", -height / 2 + margin.top)
      .attr("y", margin.left / 2)
      .attr("transform", "rotate(-90)")
      .text("Amplitude");

  }, [data]);

  return <svg ref={ref}></svg>;
};

export default FFTWaveView;
