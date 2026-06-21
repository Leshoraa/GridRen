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
  eraserMode: 'local' | 'ai';
  setEraserMode: (mode: 'local' | 'ai') => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
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
  eraserMode,
  setEraserMode,
  aiPrompt,
  setAiPrompt,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Object Eraser</div>
      <div className="module-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Brush over unwanted objects. Choose Quick Erase for local instant removal, or Smart Fill to reconstruct background using Generative AI.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            <button
              className={`btn ${eraserMode === 'local' ? 'btn-active' : ''}`}
              style={{ flex: 1, fontSize: '11px', padding: '6px 4px' }}
              onClick={() => setEraserMode('local')}
            >
              Quick Erase (Local)
            </button>
            <button
              className={`btn ${eraserMode === 'ai' ? 'btn-active' : ''}`}
              style={{ flex: 1, fontSize: '11px', padding: '6px 4px' }}
              onClick={() => setEraserMode('ai')}
            >
              Smart Fill (AI)
            </button>
          </div>

          {eraserMode === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Prompt / Instructions</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{
                  width: '100%',
                  height: '60px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '6px 8px',
                  fontSize: '12px',
                  resize: 'none'
                }}
                placeholder="Describe what to reconstruct or fill..."
              />
            </div>
          )}

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
              disabled={!hasMaskPixels || (eraserMode === 'local' && !isCvReady)}
              style={{ width: '100%', fontWeight: 'bold' }}
            >
              {eraserMode === 'ai'
                ? 'Generate Pixels (AI)'
                : isCvReady ? 'Erase Object' : 'Loading OpenCV...'}
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

