import React, { useState } from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface ColorMixerModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

type HslTab = 'hue' | 'sat' | 'lum';

export const ColorMixerModule: React.FC<ColorMixerModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const [activeTab, setActiveTab] = useState<HslTab>('hue');

  const channels = [
    { name: 'Red', key: 'Red', hex: '#E53935' },
    { name: 'Orange', key: 'Orange', hex: '#FB8C00' },
    { name: 'Yellow', key: 'Yellow', hex: '#FDD835' },
    { name: 'Green', key: 'Green', hex: '#43A047' },
    { name: 'Aqua', key: 'Aqua', hex: '#00ACC1' },
    { name: 'Blue', key: 'Blue', hex: '#1E88E5' },
    { name: 'Purple', key: 'Purple', hex: '#5E35B1' },
    { name: 'Magenta', key: 'Magenta', hex: '#D81B60' },
  ];

  const getSliderKey = (colorKey: string, tab: HslTab): keyof AdjustmentState => {
    const capitalizedTab = tab.charAt(0).toUpperCase() + tab.slice(1);
    return `hsl${capitalizedTab}${colorKey}` as keyof AdjustmentState;
  };

  const getTabLabel = (tab: HslTab) => {
    switch (tab) {
      case 'hue': return 'Hue';
      case 'sat': return 'Saturation';
      case 'lum': return 'Luminance';
    }
  };

  return (
    <div className="control-module active-module" onMouseUp={onMouseUp}>
      <div className="module-title-clean">Color Mixer (HSL)</div>
      
      <div className="mixer-tabs" style={{ marginBottom: '16px' }}>
        {(['hue', 'sat', 'lum'] as HslTab[]).map(tab => (
          <button
            key={tab}
            className={`mixer-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      <div className="mixer-sliders">
        {channels.map(ch => {
          const key = getSliderKey(ch.key, activeTab);
          const val = (adjustments[key] as number) ?? 0;

          return (
            <SwissSlider
              key={ch.name}
              label={ch.name}
              value={val}
              min={-1}
              max={1}
              step={0.01}
              onChange={newVal => onChange(key, newVal)}
              onCommit={onMouseUp}
              showPlusSign={true}
              labelStyle={{ color: ch.hex, fontWeight: 900 }}
            />
          );
        })}
      </div>
    </div>
  );
};
export default ColorMixerModule;
