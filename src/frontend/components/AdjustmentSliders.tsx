import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';

interface AdjustmentSlidersProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, value: any) => void;
}

export const AdjustmentSliders: React.FC<AdjustmentSlidersProps> = ({
  adjustments,
  onChange,
}) => {
  const sliders: {
    key: keyof AdjustmentState;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    { key: 'exposure', label: 'Exposure', min: -2, max: 2, step: 0.01 },
    { key: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.01 },
    { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01 },
    { key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
    { key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
    { key: 'bloomThreshold', label: 'Bloom Threshold', min: 0, max: 1, step: 0.01 },
    { key: 'bloomIntensity', label: 'Bloom Intensity', min: 0, max: 2, step: 0.01 },
    { key: 'bloomRadius', label: 'Bloom Radius', min: 1, max: 50, step: 1 },
  ];

  const bloomColors: { name: string; value: [number, number, number] | null }[] = [
    { name: 'Standard', value: null },
    { name: 'Swiss Red', value: [216, 0, 0] },
    { name: 'Cobalt', value: [0, 71, 171] },
    { name: 'Warm Amber', value: [255, 191, 0] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sliders.map(s => (
        <div key={s.key} className="slider-group">
          <div className="slider-header">
            <span className="slider-name">{s.label}</span>
            <span className="slider-value">
              {Number(adjustments[s.key as keyof AdjustmentState] ?? 0).toFixed(s.step === 1 ? 0 : 2)}
            </span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={s.min}
            max={s.max}
            step={s.step}
            value={Number(adjustments[s.key as keyof AdjustmentState] ?? 0)}
            onChange={e => onChange(s.key, parseFloat(e.target.value))}
          />
        </div>
      ))}
      <div className="color-picker-group">
        <div className="slider-header">
          <span className="slider-name">Bloom Chromatic Tint</span>
        </div>
        <div className="color-swatches">
          {bloomColors.map((color, idx) => {
            const isSelected =
              (color.value === null && adjustments.bloomColor === null) ||
              (color.value &&
                adjustments.bloomColor &&
                color.value[0] === adjustments.bloomColor[0] &&
                color.value[1] === adjustments.bloomColor[1] &&
                color.value[2] === adjustments.bloomColor[2]);
            return (
              <button
                key={idx}
                className={`color-swatch ${isSelected ? 'active' : ''}`}
                style={{
                  backgroundColor: color.value
                    ? `rgb(${color.value[0]}, ${color.value[1]}, ${color.value[2]})`
                    : '#FFF',
                  borderRadius: '0px',
                }}
                onClick={() => onChange('bloomColor', color.value)}
                title={color.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
