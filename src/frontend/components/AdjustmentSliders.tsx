import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface AdjustmentSlidersProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, value: any) => void;
  onCommit?: () => void;
}

export const AdjustmentSliders: React.FC<AdjustmentSlidersProps> = ({
  adjustments,
  onChange,
  onCommit,
}) => {
  const coreSliders = [
    { key: 'exposure' as keyof AdjustmentState, label: 'Exposure', min: -2, max: 2, step: 0.01 },
    { key: 'contrast' as keyof AdjustmentState, label: 'Contrast', min: 0, max: 2, step: 0.01 },
    { key: 'saturation' as keyof AdjustmentState, label: 'Saturation', min: 0, max: 2, step: 0.01 },
    { key: 'vibrance' as keyof AdjustmentState, label: 'Vibrance', min: -1, max: 1, step: 0.01 },
    { key: 'highlights' as keyof AdjustmentState, label: 'Highlights', min: -1, max: 1, step: 0.01 },
    { key: 'shadows' as keyof AdjustmentState, label: 'Shadows', min: -1, max: 1, step: 0.01 },
    { key: 'whites' as keyof AdjustmentState, label: 'Whites', min: -1, max: 1, step: 0.01 },
    { key: 'blacks' as keyof AdjustmentState, label: 'Blacks', min: -1, max: 1, step: 0.01 },
    { key: 'gamma' as keyof AdjustmentState, label: 'Gamma', min: 0.5, max: 2.0, step: 0.01 },
    { key: 'fade' as keyof AdjustmentState, label: 'Fade / Matte', min: 0, max: 1, step: 0.01 },
  ];

  const colorSliders = [
    { key: 'temperature' as keyof AdjustmentState, label: 'Temperature', min: -1, max: 1, step: 0.01 },
    { key: 'tint' as keyof AdjustmentState, label: 'Tint', min: -1, max: 1, step: 0.01 },
  ];

  const bloomSliders = [
    { key: 'bloomIntensity' as keyof AdjustmentState, label: 'Bloom Intensity', min: 0, max: 2, step: 0.01 },
    { key: 'bloomThreshold' as keyof AdjustmentState, label: 'Bloom Threshold', min: 0, max: 1, step: 0.01 },
    { key: 'bloomRadius' as keyof AdjustmentState, label: 'Bloom Radius', min: 1, max: 50, step: 1 },
  ];

  const analogueSliders = [
    { key: 'grainIntensity' as keyof AdjustmentState, label: 'Grain Intensity', min: 0, max: 1, step: 0.01 },
    { key: 'grainSize' as keyof AdjustmentState, label: 'Grain Size', min: 1, max: 5, step: 1 },
    { key: 'vignetteIntensity' as keyof AdjustmentState, label: 'Vignette', min: 0, max: 1, step: 0.01 },
    { key: 'chromaticAberration' as keyof AdjustmentState, label: 'Aberration (px)', min: 0, max: 15, step: 1 },
  ];

  const bloomColors: { name: string; value: [number, number, number] | null }[] = [
    { name: 'Standard', value: null },
    { name: 'Swiss Red', value: [216, 0, 0] },
    { name: 'Cobalt', value: [0, 71, 171] },
    { name: 'Warm Amber', value: [255, 191, 0] },
  ];

  const renderSlider = (s: { key: keyof AdjustmentState; label: string; min: number; max: number; step: number }) => {
    return (
      <SwissSlider
        key={s.key}
        label={s.label}
        value={Number(adjustments[s.key] ?? 0)}
        min={s.min}
        max={s.max}
        step={s.step}
        onChange={val => onChange(s.key, val)}
        onCommit={onCommit}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="slider-section">
        <div className="slider-section-title">Tone & Light</div>
        <div className="slider-section-content">
          {coreSliders.map(renderSlider)}
        </div>
      </div>

      <div className="slider-section">
        <div className="slider-section-title">Color Grade</div>
        <div className="slider-section-content">
          {colorSliders.map(renderSlider)}
        </div>
      </div>

      <div className="slider-section">
        <div className="slider-section-title">Bloom Engine</div>
        <div className="slider-section-content">
          {bloomSliders.map(renderSlider)}

          <div className="color-picker-group" style={{ marginTop: '12px' }}>
            <div className="slider-header" style={{ marginBottom: '8px' }}>
              <span className="slider-name">Bloom Tint</span>
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
      </div>

      <div className="slider-section">
        <div className="slider-section-title">Analogue Effects</div>
        <div className="slider-section-content">
          {analogueSliders.map(renderSlider)}
        </div>
      </div>
    </div>
  );
};
export default AdjustmentSliders;
