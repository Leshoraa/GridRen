import React from 'react';
import { AdjustmentSliders } from './AdjustmentSliders';
import { AdjustmentState } from '../utils/imageProcess';
import { MaskData } from './CanvasWorkspace';

interface AdjustmentsModuleProps {
  activeMask: MaskData | undefined;
  globalAdjustments: AdjustmentState;
  handleAdjustmentChange: (key: keyof AdjustmentState, val: number) => void;
  commitAdjustmentHistory: () => void;
}

export const AdjustmentsModule: React.FC<AdjustmentsModuleProps> = ({
  activeMask,
  globalAdjustments,
  handleAdjustmentChange,
  commitAdjustmentHistory,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">
        {activeMask ? `Adjustments (${activeMask.name})` : 'Adjustments (Global)'}
      </div>
      <div className="module-content" onMouseUp={commitAdjustmentHistory}>
        <AdjustmentSliders
          adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
          onChange={handleAdjustmentChange}
        />
      </div>
    </div>
  );
};
