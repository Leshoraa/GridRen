import React, { useState } from 'react';
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
  const [expanded, setExpanded] = useState<string[]>(['bloom', 'halation']);

  const toggleSection = (id: string) => {
    setExpanded(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

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
      <div className="module-title-clean">Effects & Stylize</div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('bloom')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <span>Bloom Effect</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('bloom') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('bloom') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
        </div>
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('halation')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Halation</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('halation') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('halation') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
        </div>
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('glitch')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Glitch & Light Leaks</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('glitch') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('glitch') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
        </div>
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('duotone')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Duotone Mapping</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('duotone') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('duotone') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('filters')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Creative Filters</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('filters') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('filters') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
        </div>
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('vignette')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Vignette Shape</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('vignette') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('vignette') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
        </div>
      </div>

      <div
        className="module-subtitle"
        onClick={() => toggleSection('grain')}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', marginTop: '12px' }}
      >
        <span>Film Grain Sim</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
          {expanded.includes('grain') ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      <div className={`accordion-content ${expanded.includes('grain') ? 'expanded' : ''}`}>
        <div className="accordion-inner">
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
      </div>
    </div>
  );
};
export default CreativeEffectsModule;
