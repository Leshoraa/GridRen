import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface LensModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

export const LensModule: React.FC<LensModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const sliders = [
    { key: 'fisheye' as keyof AdjustmentState, label: 'Fisheye Warp', min: -1, max: 1, step: 0.01 },
    { key: 'distortion' as keyof AdjustmentState, label: 'Lens Distortion', min: -1, max: 1, step: 0.01 },
    { key: 'chromaticAberration' as keyof AdjustmentState, label: 'Chromatic Aberration', min: 0, max: 20, step: 1 },
    { key: 'borderWidth' as keyof AdjustmentState, label: 'Border Width', min: 0, max: 0.2, step: 0.005 },
    { key: 'borderHue' as keyof AdjustmentState, label: 'Border Hue', min: 0, max: 360, step: 1 },
  ];

  return (
    <div className="control-module active-module" onMouseUp={onMouseUp}>
      <div className="module-title-clean">Lens & Border</div>
      <div className="slider-section-content">
        {sliders.map(s => (
          <SwissSlider
            key={s.key}
            label={s.label}
            value={(adjustments[s.key] as number) ?? 0}
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
export default LensModule;
