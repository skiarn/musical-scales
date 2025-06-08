'use client';

import React from 'react';
import { FrequencyBand } from '../utils/frequency-analyzer';

type BandAnalysis = {
  name: string;
  energies: number[];
  trend: string | null;
};

interface FrequencyBandAnalysisProps {
  analysis: BandAnalysis[];
}

const FrequencyBandAnalysis: React.FC<FrequencyBandAnalysisProps> = ({ analysis }) => {
  // Filter out bands with zero energy
  const nonZeroBands = analysis.filter(band => {
    const avgEnergy = band.energies.reduce((a, b) => a + b, 0) / band.energies.length;
    return avgEnergy > 0;
  });

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Frequency Band Analysis</h3>
      <div className="grid gap-4">
        {nonZeroBands.map((band, index) => {
          const avgEnergy = band.energies.reduce((a, b) => a + b, 0) / band.energies.length;
          const trendColor = band.trend === 'increasing' ? 'text-green-600' : 
                           band.trend === 'decreasing' ? 'text-red-600' : 'text-gray-600';
          if (avgEnergy.toFixed(3) === '0.000') return null; // Skip bands with zero average energy
          return (
            <div key={band.name} className="bg-white p-3 rounded shadow">
              <div className="flex justify-between items-center">
                <span className="font-medium">{band.name}</span>
                <span className={`${trendColor} font-medium`}>{band.trend}</span>
              </div>
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded">
                  <div 
                    className="h-full bg-blue-500 rounded" 
                    style={{ width: `${Math.min(100, avgEnergy * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Average Energy: {avgEnergy.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FrequencyBandAnalysis;
