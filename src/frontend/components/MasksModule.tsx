import React from 'react';
import { MaskData } from './CanvasWorkspace';
import { AdjustmentState, CurvesState, PresetType } from '../utils/imageProcess';

interface MasksModuleProps {
  masks: MaskData[];
  activeMaskId: string | null;
  setActiveMaskId: (id: string | null) => void;
  addMask: (type: 'brush' | 'radial' | 'linear') => void;
  deleteMask: (id: string, e: React.MouseEvent) => void;
  toggleMaskVisibility: (id: string, e: React.MouseEvent) => void;
  pushHistory: (nextAdj?: AdjustmentState, nextCrv?: CurvesState, nextPre?: PresetType, nextMsk?: MaskData[], nextAct?: string | null) => void;
  globalAdjustments: AdjustmentState;
  globalCurves: CurvesState;
  globalPreset: PresetType;
  activeMask: MaskData | undefined;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushFeather: number;
  setBrushFeather: (feather: number) => void;
  brushOpacity: number;
  setBrushOpacity: (opacity: number) => void;
  brushMode: 'add' | 'erase';
  setBrushMode: (mode: 'add' | 'erase') => void;
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
}

export const MasksModule: React.FC<MasksModuleProps> = ({
  masks,
  activeMaskId,
  setActiveMaskId,
  addMask,
  deleteMask,
  toggleMaskVisibility,
  pushHistory,
  globalAdjustments,
  globalCurves,
  globalPreset,
  activeMask,
  brushSize,
  setBrushSize,
  brushFeather,
  setBrushFeather,
  brushOpacity,
  setBrushOpacity,
  brushMode,
  setBrushMode,
  showOverlay,
  setShowOverlay,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Selective Masks</div>
      <div className="module-content">
        <div className="masking-tools">
          <div className="mask-types">
            <button className="btn" onClick={() => addMask('brush')}>+ Brush</button>
            <button className="btn" onClick={() => addMask('radial')}>+ Radial</button>
            <button className="btn" onClick={() => addMask('linear')}>+ Linear</button>
          </div>

          {masks.length > 0 && (
            <div className="mask-list">
              {masks.map(m => (
                <div
                  key={m.id}
                  className={`mask-item ${activeMaskId === m.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveMaskId(m.id);
                    pushHistory(globalAdjustments, globalCurves, globalPreset, masks, m.id);
                  }}
                >
                  <span className="mask-item-name">{m.name}</span>
                  <div className="mask-item-controls">
                    <button
                      className={`mask-icon-btn ${m.visible ? 'active' : ''}`}
                      onClick={e => toggleMaskVisibility(m.id, e)}
                    >
                      {m.visible ? 'Hide' : 'Show'}
                    </button>
                    <button
                      className="mask-icon-btn"
                      onClick={e => deleteMask(m.id, e)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeMaskId && (
            <button
              className="btn"
              style={{ borderColor: 'var(--text-primary)', width: '100%', marginTop: '12px' }}
              onClick={() => {
                setActiveMaskId(null);
                pushHistory(globalAdjustments, globalCurves, globalPreset, masks, null);
              }}
            >
              Exit Local Mask Editing
            </button>
          )}

          {activeMask && activeMask.type === 'brush' && (
            <div className="brush-controls" style={{ marginTop: '16px' }}>
              <div className="slider-header">
                <span className="slider-name">Brush Size</span>
                <span className="slider-value">{brushSize}px</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="5"
                max="100"
                value={brushSize}
                onChange={e => setBrushSize(parseInt(e.target.value))}
              />

              <div className="slider-header">
                <span className="slider-name">Brush Feather</span>
                <span className="slider-value">{Math.round(brushFeather * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0"
                max="1"
                step="0.05"
                value={brushFeather}
                onChange={e => setBrushFeather(parseFloat(e.target.value))}
              />

              <div className="slider-header">
                <span className="slider-name">Brush Opacity</span>
                <span className="slider-value">{Math.round(brushOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min="0.1"
                max="1"
                step="0.05"
                value={brushOpacity}
                onChange={e => setBrushOpacity(parseFloat(e.target.value))}
              />

              <div className="slider-header" style={{ marginTop: '12px' }}>
                <button
                  className={`btn ${brushMode === 'add' ? 'btn-active' : ''}`}
                  style={{ flex: 1, marginRight: '4px' }}
                  onClick={() => setBrushMode('add')}
                >
                  Paint Add
                </button>
                <button
                  className={`btn ${brushMode === 'erase' ? 'btn-active' : ''}`}
                  style={{ flex: 1, marginLeft: '4px' }}
                  onClick={() => setBrushMode('erase')}
                >
                  Paint Erase
                </button>
              </div>
            </div>
          )}

          {activeMask && (
            <div className="slider-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={e => setShowOverlay(e.target.checked)}
                id="show-overlay-checkbox"
              />
              <label htmlFor="show-overlay-checkbox" style={{ fontSize: '10px', textTransform: 'uppercase', cursor: 'pointer' }}>
                Show Mask Red Overlay
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
