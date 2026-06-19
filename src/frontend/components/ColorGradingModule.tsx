import React from 'react';
import { AdjustmentState } from '../utils/imageProcess';
import { SwissSlider } from './SwissSlider';

interface ColorGradingModuleProps {
  adjustments: AdjustmentState;
  onChange: (key: keyof AdjustmentState, val: number) => void;
  onMouseUp?: () => void;
}

export const ColorGradingModule: React.FC<ColorGradingModuleProps> = ({
  adjustments,
  onChange,
  onMouseUp,
}) => {
  const wheels = [
    { name: 'Shadows', prefix: 'Shadows' },
    { name: 'Midtones', prefix: 'Midtones' },
    { name: 'Highlights', prefix: 'Highlights' },
  ];

  const handleWheelMouseDown = (
    prefix: string,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = rect.width / 2;
    
    const updateVal = (clientX: number, clientY: number) => {
      const x = clientX - rect.left - r;
      const y = clientY - rect.top - r;
      const d = Math.hypot(x, y);
      const sat = Math.min(1, d / r);
      const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

      onChange(`colorGrading${prefix}Hue` as keyof AdjustmentState, hue);
      onChange(`colorGrading${prefix}Sat` as keyof AdjustmentState, sat);
    };

    updateVal(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateVal(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (onMouseUp) onMouseUp();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Color Grading</div>
      
      <div className="grading-wheels-container">
        {wheels.map(w => {
          const hue = (adjustments[`colorGrading${w.prefix}Hue` as keyof AdjustmentState] as number) ?? 0;
          const sat = (adjustments[`colorGrading${w.prefix}Sat` as keyof AdjustmentState] as number) ?? 0;

          const r = 40;
          const dotX = r + sat * r * Math.cos(hue * Math.PI / 180);
          const dotY = r + sat * r * Math.sin(hue * Math.PI / 180);

          return (
            <div key={w.name} className="grading-wheel-wrapper">
              <span className="grading-wheel-label">{w.name}</span>
              <div
                className="grading-wheel-circle"
                onMouseDown={e => handleWheelMouseDown(w.prefix, e)}
              >
                <div
                  className="grading-wheel-dot"
                  style={{ left: `${dotX}px`, top: `${dotY}px` }}
                />
              </div>
              <span className="grading-wheel-values">
                H:{Math.round(hue)}° S:{Math.round(sat * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="slider-section" style={{ borderTop: 'none', paddingTop: '0', marginTop: '16px' }}>
        <SwissSlider
          label="Grading Balance"
          value={adjustments.colorGradingBalance ?? 0}
          min={-1}
          max={1}
          step={0.01}
          onChange={val => onChange('colorGradingBalance', val)}
          onCommit={onMouseUp}
          showPlusSign={true}
        />
      </div>
    </div>
  );
};
export default ColorGradingModule;
