import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface DetailModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

export const DetailModule: React.FC<DetailModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const sliders = [
    { key: 'clarity' as keyof AdjustmentState, label: 'Clarity', min: -1, max: 1, step: 0.01 },
    { key: 'dehaze' as keyof AdjustmentState, label: 'Dehaze', min: -1, max: 1, step: 0.01 },
    { key: 'sharpening' as keyof AdjustmentState, label: 'Sharpening', min: 0, max: 1.5, step: 0.01 },
    { key: 'denoise' as keyof AdjustmentState, label: 'Noise Reduction', min: 0, max: 1, step: 0.01 },
  ];

  return (
    <div className="control-module active-module" onMouseUp={onMouseUp}>
      <div className="module-title-clean">Detail & Texture</div>
      <div className="slider-section-content">
        {sliders.map(s => {
          const val = (adjustments[s.key] as number) ?? 0;
          return (
            <SwissSlider
              key={s.key}
              label={s.label}
              value={val}
              min={s.min}
              max={s.max}
              step={s.step}
              onChange={nextVal => onChange(s.key, nextVal)}
              onCommit={onMouseUp}
            />
          );
        })}
      </div>
    </div>
  );
};
export default DetailModule;
