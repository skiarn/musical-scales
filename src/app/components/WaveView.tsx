import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';

interface WaveViewProps {
  data: { x: number, y: number }[];
  onSelection: (selectedData: { x: number, y: number }[]) => void;
}

const WaveView: React.FC<WaveViewProps> = ({ data, onSelection }) => {
  const ref = useRef<SVGSVGElement | null>(null);

  // Memoize data length to check for changes
  const dataSignature = useMemo(() => ({
    length: data.length,
    firstX: data[0]?.x,
    lastX: data[data.length - 1]?.x
  }), [data.length, data[0]?.x, data[data.length - 1]?.x]);

  const drawChart = React.useCallback((svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, data: { x: number, y: number }[]) => {
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

    // Adding brush to select a range
    const brush = d3.brushX()
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
      .on('end', brushed);

    svg.append('g')
      .attr('class', 'brush')
      .call(brush);

    function brushed({ selection }: { selection: [number, number] | null }) {
      if (selection) {
        const [x0, x1] = selection.map(d => x.invert(d));
        console.log('Selected range:', x0, x1);
        // You can now handle the selected range, e.g., updating state or props
        onSelection(data.filter(d => d.x >= x0 && d.x <= x1));
      }
    }
  }, [onSelection]);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    drawChart(svg, data);
  }, [dataSignature, drawChart]); // Only redraw when data signature changes

  return <svg ref={ref}></svg>;
};

export default React.memo(WaveView); // Add memo to prevent unnecessary parent renders
