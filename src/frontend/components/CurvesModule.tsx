import React from 'react';
import { ToneCurves } from './ToneCurves';
import { CurvesState, CurvePoint } from '../utils/imageProcess';
import { MaskData } from './CanvasWorkspace';

interface CurvesModuleProps {
  activeMask: MaskData | undefined;
  globalCurves: CurvesState;
  theme: 'light' | 'dark';
  handleCurveChange: (channel: keyof CurvesState, points: CurvePoint[]) => void;
  commitAdjustmentHistory: () => void;
}

export const CurvesModule: React.FC<CurvesModuleProps> = ({
  activeMask,
  globalCurves,
  theme,
  handleCurveChange,
  commitAdjustmentHistory,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">
        {activeMask ? `Curves (${activeMask.name})` : 'Curves (Global)'}
      </div>
      <div className="module-content" onMouseUp={commitAdjustmentHistory}>
        <ToneCurves
          curves={activeMask ? activeMask.curves : globalCurves}
          theme={theme}
          onChange={handleCurveChange}
        />
      </div>
    </div>
  );
};
