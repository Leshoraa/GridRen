import React, { useState } from 'react';
import { AdjustmentSliders } from './AdjustmentSliders';
import { ColorMixerModule } from './ColorMixerModule';
import { ColorGradingModule } from './ColorGradingModule';
import { DetailModule } from './DetailModule';
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
  const [subTab, setSubTab] = useState<'basic' | 'hsl' | 'grading' | 'detail'>('basic');
  const adjustments = activeMask ? activeMask.adjustments : globalAdjustments;

  return (
    <div className="control-module active-module">
      <div className="module-title-clean">
        {activeMask ? `Adjustments (${activeMask.name})` : 'Adjustments (Global)'}
      </div>

      <div className="mixer-tabs" style={{ marginBottom: '16px' }}>
        <button
          className={`mixer-tab ${subTab === 'basic' ? 'active' : ''}`}
          onClick={() => setSubTab('basic')}
        >
          Basic
        </button>
        <button
          className={`mixer-tab ${subTab === 'hsl' ? 'active' : ''}`}
          onClick={() => setSubTab('hsl')}
        >
          HSL
        </button>
        <button
          className={`mixer-tab ${subTab === 'grading' ? 'active' : ''}`}
          onClick={() => setSubTab('grading')}
        >
          Grading
        </button>
        <button
          className={`mixer-tab ${subTab === 'detail' ? 'active' : ''}`}
          onClick={() => setSubTab('detail')}
        >
          Detail
        </button>
      </div>

      <div className="module-content" onMouseUp={commitAdjustmentHistory}>
        {subTab === 'basic' && (
          <AdjustmentSliders
            adjustments={adjustments}
            onChange={handleAdjustmentChange}
          />
        )}
        {subTab === 'hsl' && (
          <ColorMixerModule
            adjustments={adjustments}
            onChange={handleAdjustmentChange}
            onMouseUp={commitAdjustmentHistory}
          />
        )}
        {subTab === 'grading' && (
          <ColorGradingModule
            adjustments={adjustments}
            onChange={handleAdjustmentChange}
            onMouseUp={commitAdjustmentHistory}
          />
        )}
        {subTab === 'detail' && (
          <DetailModule
            adjustments={adjustments}
            onChange={handleAdjustmentChange}
            onMouseUp={commitAdjustmentHistory}
          />
        )}
      </div>
    </div>
  );
};
