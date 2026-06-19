import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface StylizeModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

export const StylizeModule: React.FC<StylizeModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const filterSliders = [
    { key: 'sepia' as keyof AdjustmentState, label: 'Sepia Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'solarize' as keyof AdjustmentState, label: 'Solarize Threshold', min: 0, max: 1, step: 0.01 },
    { key: 'posterize' as keyof AdjustmentState, label: 'Posterize Levels', min: 2, max: 64, step: 1 },
    { key: 'thermal' as keyof AdjustmentState, label: 'Thermal Map', min: 0, max: 1, step: 0.01 },
    { key: 'crossProcess' as keyof AdjustmentState, label: 'Cross Process', min: 0, max: 1, step: 0.01 },
  ];

  const vignetteSliders = [
    { key: 'vignetteIntensity' as keyof AdjustmentState, label: 'Vignette Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'vignetteFeather' as keyof AdjustmentState, label: 'Vignette Feather', min: 0.01, max: 1, step: 0.01 },
    { key: 'vignetteRoundness' as keyof AdjustmentState, label: 'Vignette Roundness', min: 0, max: 1, step: 0.01 },
  ];

  const grainSliders = [
    { key: 'grainIntensity' as keyof AdjustmentState, label: 'Grain Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'grainSize' as keyof AdjustmentState, label: 'Grain Size', min: 1, max: 5, step: 0.1 },
    { key: 'grainChroma' as keyof AdjustmentState, label: 'Grain Color (Chroma)', min: 0, max: 1, step: 0.01 },
  ];

  return (
    <div className="control-module active-module" onMouseUp={onMouseUp}>
      <div className="module-title-clean">Stylize & Analogue</div>
      
      <div className="module-subtitle">Creative Filters</div>
      <div className="slider-section-content">
        {filterSliders.map(s => (
          <SwissSlider
            key={s.key}
            label={s.label}
            value={(adjustments[s.key] as number) ?? (s.key === 'posterize' ? 64 : 0)}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={val => onChange(s.key, val)}
            onCommit={onMouseUp}
          />
        ))}
      </div>

      <div className="module-subtitle" style={{ marginTop: '16px' }}>Vignette Shape</div>
      <div className="slider-section-content">
        {vignetteSliders.map(s => (
          <SwissSlider
            key={s.key}
            label={s.label}
            value={(adjustments[s.key] as number) ?? (s.key === 'vignetteFeather' ? 0.5 : s.key === 'vignetteRoundness' ? 0.5 : 0)}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={val => onChange(s.key, val)}
            onCommit={onMouseUp}
          />
        ))}
      </div>

      <div className="module-subtitle" style={{ marginTop: '16px' }}>Film Grain Sim</div>
      <div className="slider-section-content">
        {grainSliders.map(s => (
          <SwissSlider
            key={s.key}
            label={s.label}
            value={(adjustments[s.key] as number) ?? (s.key === 'grainSize' ? 1.0 : 0)}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={val => onChange(s.key, val)}
            onCommit={onMouseUp}
          />
        ))}
      </div>
    </div>
  );
};
export default StylizeModule;
