import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface FFTWaveViewProps {
  data: { x: number, y: number }[];
}

interface Marker {
  x: number;
  y: number;
  stuck: boolean;
}

const FFTWaveView: React.FC<FFTWaveViewProps> = ({ data }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

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

    // Adding a cursor with marker
    const cursor = svg.append('g')
      .attr('class', 'cursor')
      .style('display', 'none');

    cursor.append('line')
      .attr('class', 'cursor-line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'red')
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none');

    const cursorMarker = cursor.append('circle')
      .attr('class', 'cursor-marker')
      .attr('r', 5)
      .attr('fill', 'red')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none');

    const cursorText = cursor.append('text')
      .attr('class', 'cursor-text')
      .attr('fill', 'black')
      .attr('text-anchor', 'start')
      .attr('dy', '-0.5em');

    svg.on('mousemove', (event) => {
      const [mouseX] = d3.pointer(event);
      const xValue = x.invert(mouseX);
      const closestData = data.reduce((prev, curr) => Math.abs(curr.x - xValue) < Math.abs(prev.x - xValue) ? curr : prev, data[0]);
      const cursorX = x(closestData.x);
      const cursorY = y(closestData.y);

      cursor.attr('transform', `translate(${cursorX},0)`);
      cursorMarker.attr('cy', cursorY);
      cursorText.attr('x', 10).attr('y', cursorY);
      cursorText.text(`x: ${closestData.x.toFixed(2)}, y: ${closestData.y.toFixed(2)}`);

      cursor.style('display', 'block');
    });

    svg.on('mouseout', () => {
      cursor.style('display', 'none');
    });

    svg.on('dblclick', () => {
      const [mouseX] = d3.pointer(event);
      const xValue = x.invert(mouseX);
      const closestData = data.reduce((prev, curr) => Math.abs(curr.x - xValue) < Math.abs(prev.x - xValue) ? curr : prev, data[0]);
      setMarkers([...markers, { ...closestData, stuck: false }]);
    });

    markers.forEach((marker, index) => {
      const markerGroup = svg.append<SVGGElement>('g')
        .attr('class', `marker-${index}`)
        .attr('transform', `translate(${x(marker.x)},0)`)
        .on('click', () => {
          if (!marker.stuck) setDraggingIndex(index);
        })
        .on('dblclick', () => {
          setMarkers(markers.map((m, i) => i === index ? { ...m, stuck: !m.stuck } : m));
        });

      if (!marker.stuck && draggingIndex === index) {
        markerGroup.call(
          d3.drag<SVGGElement, unknown>()
            .on('drag', (event) => {
              const [mouseX] = d3.pointer(event);
              const xValue = x.invert(mouseX);
              const closestData = data.reduce((prev, curr) => Math.abs(curr.x - xValue) < Math.abs(prev.x - xValue) ? curr : prev, data[0]);
              setMarkers(markers.map((m, i) => i === index ? { ...closestData, stuck: m.stuck } : m));
            })
            .on('end', () => setDraggingIndex(null))
        );
      }

      markerGroup.append('line')
        .attr('class', 'cursor-line')
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', 'red')
        .attr('stroke-width', 1);

      markerGroup.append('circle')
        .attr('class', 'cursor-marker')
        .attr('r', 5)
        .attr('fill', 'red')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('cy', y(marker.y));

      markerGroup.append('text')
        .attr('class', 'cursor-text')
        .attr('fill', 'black')
        .attr('text-anchor', 'start')
        .attr('x', 10)
        .attr('y', y(marker.y))
        .attr('dy', '-0.5em')
        .text(`x: ${marker.x.toFixed(2)}, y: ${marker.y.toFixed(2)}`);
    });

  }, [data, markers, draggingIndex]);

  return (
    <div>
      <svg ref={ref}></svg>
    </div>
  );
};

export default FFTWaveView;
