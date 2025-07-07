import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { applyHanningWindow } from '@/app/utils/signal-processing';

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
  onZoom:(reset: boolean, from: number, to: number, funcZoom: FuncZoom<{ x: number; y: number }>) => void;
  onFilter: (window: string, enabled: boolean, funcWindow: FuncFilter<{ x: number, y: number }>) => void;
}

function zoomImpl(  input: { x: number, y: number }[],
  from: number,
  to: number): { x: number, y: number }[] {
  return input.filter(d => d.x >= from && d.x <= to);
}

const WaveView: React.FC<WaveViewProps> = ({ data, options, onFilter, onZoom }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Memoize data length to check for changes
  const dataSignature = useMemo(
    () => ({
      length: data.length,
      firstX: data[0]?.x,
      lastX: data[data.length - 1]?.x,
    }),
    [data]
  );

  const drawChart = React.useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, data: { x: number, y: number }[]) => {
      const width = options?.width || 800;
      const height = options?.height || 400;
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };

      svg.attr('width', width).attr('height', height);

      // Determine the domain for x and y scales based on the data
      const xDomain = d3.extent(data, (d) => d.x) as [number, number];
      const yDomain = d3.extent(data, (d) => d.y) as [number, number];

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
        .x((d) => x(d.x))
        .y((d) => y(d.y));

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

      svg.append('g').attr('class', 'brush').call(brush);

      function brushed({ selection }: { selection: [number, number] | null }) {
        if (selection) {
          const [x0, x1] = selection.map((d) => x.invert(d));
          console.log('Selected range:', x0, x1);
          onZoom(false, x0, x1, zoomImpl);    
        }
      }

      // Enhanced filter menu implementation
      if (options?.filter?.windows) {
        const expandedMenuWidth = 150;
        const collapsedMenuWidth = 40;
        const menuWidth = isMenuOpen ? expandedMenuWidth : collapsedMenuWidth;
        const itemHeight = 30;
        const menuPadding = 5;
        const headerHeight = itemHeight + (menuPadding * 2);
        const menuItems = [...options.filter.windows, 'Reset Zoom'];
        const menuMargin = 5;

        // Add drop shadow filter
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
          .attr('transform', `translate(${width - menuWidth - menuMargin}, ${menuMargin})`);

        // Menu header/toggle with hamburger icon
        const toggleButton = filterGroup
          .append('g')
          .attr('transform', `translate(0, 0)`)
          .style('cursor', 'pointer')
          .on('click', () => setIsMenuOpen(!isMenuOpen));

        toggleButton
          .append('rect')
          .attr('width', menuWidth)
          .attr('height', headerHeight)
          .attr('fill', '#f8f9fa')
          .attr('rx', 6)
          .attr('ry', 6);

        // Adjust hamburger icon position to always be on the right
        const iconSize = 18;
        const iconX = menuWidth - iconSize - 10; // Always position from right edge
        const iconY = (headerHeight - 12) / 2;
        
        toggleButton
          .selectAll('.menu-line')
          .data([0, 1, 2])
          .enter()
          .append('line')
          .attr('class', 'menu-line')
          .attr('x1', iconX)
          .attr('x2', iconX + iconSize)
          .attr('y1', d => iconY + (d * 6))
          .attr('y2', d => iconY + (d * 6))
          .attr('stroke', '#666')
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round')
          .style('transition', 'transform 0.2s ease-in-out'); // Add transition for smooth movement

        // Rest of the menu items code only when expanded
        if (isMenuOpen) {
          // Divider line
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
              .on('click', () => {
                if (item === 'Reset Zoom') {
                  onZoom(true, 0, 0, zoomImpl);
                } else {
                  const newActiveFilters = new Set(activeFilters);
                  if (newActiveFilters.has(item)) {
                    newActiveFilters.delete(item);
                    onFilter(item, false, applyHanningWindow);
                  } else {
                    newActiveFilters.add(item);
                    onFilter(item, true, applyHanningWindow);
                  }
                  setActiveFilters(newActiveFilters);
                }
              });

            // Hover effect background
            filterItem
              .append('rect')
              .attr('width', menuWidth)
              .attr('height', itemHeight)
              .attr('fill', 'transparent')
              .attr('class', 'menu-item-bg')
              .style('transition', 'fill 0.1s ease-in-out');

            // Active state indicator
            if (item !== 'Reset Zoom' && activeFilters.has(item)) {
              filterItem
                .append('circle')
                .attr('cx', menuPadding + 8)
                .attr('cy', itemHeight/2)
                .attr('r', 3)
                .attr('fill', '#007bff');
            }

            filterItem
              .append('text')
              .attr('x', menuPadding + 20)
              .attr('y', itemHeight/2 + 5)
              .text(item)
              .attr('fill', item === 'Reset Zoom' ? '#dc3545' : '#333')
              .style('font-size', '13px')
              .style('opacity', isMenuOpen ? 1 : 0)
              .style('transition', 'opacity 0.2s ease-in-out');

            // Add hover effect
            filterItem
              .on('mouseenter', function() {
                d3.select(this).select('.menu-item-bg')
                  .attr('fill', item === 'Reset Zoom' ? '#fff5f5' : '#f8f9fa');
              })
              .on('mouseleave', function() {
                d3.select(this).select('.menu-item-bg')
                  .attr('fill', 'transparent');
              });
          });
        }
      }
    },
    [onZoom, options, activeFilters, onFilter, isMenuOpen]
  );

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    drawChart(svg, data);
  }, [data, dataSignature, drawChart]); // Only redraw when data signature changes

  return <svg ref={ref}></svg>;
};

export default React.memo(WaveView); // Add memo to prevent unnecessary parent renders
