import React from 'react';

interface TransformModuleProps {
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  splitRatio: number | null;
  onToggleSplit: () => void;
}

export const TransformModule: React.FC<TransformModuleProps> = ({
  onRotateCW,
  onRotateCCW,
  onFlipH,
  onFlipV,
  splitRatio,
  onToggleSplit,
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
