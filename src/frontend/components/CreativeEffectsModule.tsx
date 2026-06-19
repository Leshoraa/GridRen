import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface CreativeEffectsModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

export const CreativeEffectsModule: React.FC<CreativeEffectsModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const bloomSliders = [
    { key: 'bloomIntensity' as keyof AdjustmentState, label: 'Bloom Intensity', min: 0, max: 2, step: 0.01 },
    { key: 'bloomThreshold' as keyof AdjustmentState, label: 'Bloom Threshold', min: 0.5, max: 1.0, step: 0.01 },
    { key: 'bloomRadius' as keyof AdjustmentState, label: 'Bloom Radius', min: 1, max: 30, step: 1 },
  ];

  const halSliders = [
    { key: 'halationIntensity' as keyof AdjustmentState, label: 'Halation Intensity', min: 0, max: 2, step: 0.01 },
    { key: 'halationThreshold' as keyof AdjustmentState, label: 'Halation Threshold', min: 0.5, max: 1.0, step: 0.01 },
    { key: 'halationRadius' as keyof AdjustmentState, label: 'Halation Radius', min: 1, max: 20, step: 1 },
  ];

  const miscSliders = [
    { key: 'mistIntensity' as keyof AdjustmentState, label: 'Mist Diffusion', min: 0, max: 2, step: 0.01 },
    { key: 'glitchSplit' as keyof AdjustmentState, label: 'Glitch RGB Split', min: 0, max: 50, step: 1 },
    { key: 'glitchBlock' as keyof AdjustmentState, label: 'Glitch Blockiness', min: 0, max: 100, step: 1 },
    { key: 'colorLeakIntensity' as keyof AdjustmentState, label: 'Color Leak Intensity', min: 0, max: 2, step: 0.01 },
    { key: 'colorLeakHue' as keyof AdjustmentState, label: 'Color Leak Hue', min: 0, max: 360, step: 1 },
  ];

  const duoSliders = [
    { key: 'duoMix' as keyof AdjustmentState, label: 'Duotone Mix', min: 0, max: 1, step: 0.01 },
    { key: 'duoShadowHue' as keyof AdjustmentState, label: 'Shadow Hue', min: 0, max: 360, step: 1 },
    { key: 'duoShadowSat' as keyof AdjustmentState, label: 'Shadow Saturation', min: 0, max: 1, step: 0.01 },
    { key: 'duoHighlightHue' as keyof AdjustmentState, label: 'Highlight Hue', min: 0, max: 360, step: 1 },
    { key: 'duoHighlightSat' as keyof AdjustmentState, label: 'Highlight Saturation', min: 0, max: 1, step: 0.01 },
  ];

  return (
    <div className="control-module active-module" onMouseUp={onMouseUp}>
      <div className="module-title-clean">Creative Effects</div>
      
      <div className="module-subtitle">Bloom Effect</div>
      <div className="slider-section-content">
        {bloomSliders.map(s => (
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

      <div className="module-subtitle" style={{ marginTop: '16px' }}>Halation</div>
      <div className="slider-section-content">
        {halSliders.map(s => (
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

      <div className="module-subtitle" style={{ marginTop: '16px' }}>Glitch & Light Leaks</div>
      <div className="slider-section-content">
        {miscSliders.map(s => (
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

      <div className="module-subtitle" style={{ marginTop: '16px' }}>Duotone Mapping</div>
      <div className="slider-section-content">
        {duoSliders.map(s => (
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
export default CreativeEffectsModule;
