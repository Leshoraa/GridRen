import React from 'react';
import { SwissSlider } from './SwissSlider';

interface EraserModuleProps {
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushFeather: number;
  setBrushFeather: (feather: number) => void;
  brushOpacity: number;
  setBrushOpacity: (opacity: number) => void;
  brushMode: 'add' | 'erase';
  setBrushMode: (mode: 'add' | 'erase') => void;
  onClearMask: () => void;
  onApplyErase: () => void;
  hasMaskPixels: boolean;
  isCvReady?: boolean;
}

export const EraserModule: React.FC<EraserModuleProps> = ({
  brushSize,
  setBrushSize,
  brushFeather,
  setBrushFeather,
  brushOpacity,
  setBrushOpacity,
  brushMode,
  setBrushMode,
  onClearMask,
  onApplyErase,
  hasMaskPixels,
  isCvReady = false,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Object Eraser</div>
      <div className="module-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Brush over spots, dust, blemishes, or unwanted objects on the image to select them, then click "Erase Object" to remove them.
          </p>

          <SwissSlider
            label="Brush Size"
            value={brushSize}
            min={5}
            max={100}
            step={1}
            onChange={setBrushSize}
          />

          <SwissSlider
            label="Brush Feather"
            value={brushFeather}
            min={0}
            max={1}
            step={0.01}
            onChange={setBrushFeather}
          />

          <SwissSlider
            label="Brush Opacity"
            value={brushOpacity}
            min={0.1}
            max={1}
            step={0.01}
            onChange={setBrushOpacity}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              className={`btn ${brushMode === 'add' ? 'btn-active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setBrushMode('add')}
            >
              Paint Select
            </button>
            <button
              className={`btn ${brushMode === 'erase' ? 'btn-active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setBrushMode('erase')}
            >
              Paint Erase
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn btn-accent"
              onClick={onApplyErase}
              disabled={!hasMaskPixels || !isCvReady}
              style={{ width: '100%', fontWeight: 'bold' }}
            >
              {isCvReady ? 'Erase Object' : 'Loading OpenCV...'}
            </button>
            <button
              className="btn"
              onClick={onClearMask}
              disabled={!hasMaskPixels}
              style={{ width: '100%' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EraserModule;
