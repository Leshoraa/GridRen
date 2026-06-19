import React from 'react';

interface TransformModuleProps {
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  splitRatio: number | null;
  onToggleSplit: () => void;
  cropMode: boolean;
  setCropMode: (mode: boolean) => void;
  cropAspectRatio: string;
  setCropAspectRatio: (ratio: string) => void;
  customRatioW: number;
  setCustomRatioW: (w: number) => void;
  customRatioH: number;
  setCustomRatioH: (h: number) => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}

export const TransformModule: React.FC<TransformModuleProps> = ({
  onRotateCW,
  onRotateCCW,
  onFlipH,
  onFlipV,
  splitRatio,
  onToggleSplit,
  cropMode,
  setCropMode,
  cropAspectRatio,
  setCropAspectRatio,
  customRatioW,
  setCustomRatioW,
  customRatioH,
  setCustomRatioH,
  onApplyCrop,
  onCancelCrop,
}) => {
  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Transform & Geometry</div>

      <div className="transform-section-label">Rotate</div>
      <div className="transform-grid" style={{ marginBottom: '20px' }}>
        <button className="transform-btn" onClick={onRotateCW} title="Rotate 90° Clockwise">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rotate_right</span>
          <span>Rotate CW</span>
        </button>
        <button className="transform-btn" onClick={onRotateCCW} title="Rotate 90° Counter-Clockwise">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>rotate_left</span>
          <span>Rotate CCW</span>
        </button>
      </div>

      <div className="transform-section-label">Flip</div>
      <div className="transform-grid" style={{ marginBottom: '20px' }}>
        <button className="transform-btn" onClick={onFlipH} title="Flip Horizontally">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>swap_horiz</span>
          <span>Flip H</span>
        </button>
        <button className="transform-btn" onClick={onFlipV} title="Flip Vertically">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>swap_vert</span>
          <span>Flip V</span>
        </button>
      </div>

      <div className="transform-section-label">Crop & Aspect Ratio</div>
      <div style={{ marginBottom: '20px' }}>
        {!cropMode ? (
          <button
            className="transform-btn"
            onClick={() => setCropMode(true)}
            title="Enable crop tool"
            style={{ width: '100%' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>crop</span>
            <span>Enable Crop Mode</span>
          </button>
        ) : (
          <div>
            <div className="geometry-select-wrapper">
              <select
                className="geometry-select"
                value={cropAspectRatio}
                onChange={e => setCropAspectRatio(e.target.value)}
              >
                <option value="free">Freeform</option>
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Cinematic</option>
                <option value="4:3">4:3 Standard</option>
                <option value="3:2">3:2 Classic</option>
                <option value="custom">Custom Ratio</option>
              </select>
            </div>

            {cropAspectRatio === 'custom' && (
              <div className="geometry-input-grid">
                <div className="geometry-input-container">
                  <span className="geometry-input-label">Width</span>
                  <input
                    type="number"
                    className="geometry-input"
                    value={customRatioW}
                    onChange={e => setCustomRatioW(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                  />
                </div>
                <div className="geometry-input-container">
                  <span className="geometry-input-label">Height</span>
                  <input
                    type="number"
                    className="geometry-input"
                    value={customRatioH}
                    onChange={e => setCustomRatioH(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                  />
                </div>
              </div>
            )}

            <div className="transform-grid">
              <button
                className="transform-btn transform-btn-apply"
                onClick={onApplyCrop}
                title="Apply Crop Selection"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                <span>Apply</span>
              </button>
              <button
                className="transform-btn transform-btn-cancel"
                onClick={onCancelCrop}
                title="Cancel Crop Mode"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="transform-section-label">Compare</div>
      <div className="transform-grid">
        <button
          className={`transform-btn${splitRatio !== null ? ' transform-btn-active' : ''}`}
          onClick={onToggleSplit}
          title="Before/After Split Comparison"
          style={{ gridColumn: '1 / -1' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>splitscreen</span>
          <span>{splitRatio !== null ? 'Exit Split View' : 'Split Compare'}</span>
        </button>
      </div>
    </div>
  );
};
