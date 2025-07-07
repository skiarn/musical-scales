import React from 'react';

interface HanningFilterProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const HanningFilter: React.FC<HanningFilterProps> = ({ isEnabled, onToggle }) => {
  return (
    <div style={{ margin: '10px 0' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Apply Hanning Window
      </label>
    </div>
  );
};

export default HanningFilter;
