import React from 'react';
import { PresetType } from '../utils/imageProcess';

interface PresetsModuleProps {
  globalPreset: PresetType;
  selectPreset: (type: PresetType) => void;
}

export const PresetsModule: React.FC<PresetsModuleProps> = ({
  globalPreset,
  selectPreset,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Presets</div>
      <div className="preset-grid">
        {(['none', 'mono', 'matte', 'brutalist', 'cine', 'vintage', 'cyberpunk', 'forest', 'warmgold'] as PresetType[]).map(type => (
          <div
            key={type}
            className={`preset-card ${globalPreset === type ? 'active' : ''}`}
            onClick={() => selectPreset(type)}
          >
            <div className="preset-name">{type}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
