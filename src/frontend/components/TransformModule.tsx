import React from 'react';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Columns } from 'lucide-react';

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
          <RotateCw size={16} />
          <span>Rotate CW</span>
        </button>
        <button className="transform-btn" onClick={onRotateCCW} title="Rotate 90° Counter-Clockwise">
          <RotateCcw size={16} />
          <span>Rotate CCW</span>
        </button>
      </div>

      <div className="transform-section-label">Flip</div>
      <div className="transform-grid" style={{ marginBottom: '20px' }}>
        <button className="transform-btn" onClick={onFlipH} title="Flip Horizontally">
          <FlipHorizontal size={16} />
          <span>Flip H</span>
        </button>
        <button className="transform-btn" onClick={onFlipV} title="Flip Vertically">
          <FlipVertical size={16} />
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
          <Columns size={16} />
          <span>{splitRatio !== null ? 'Exit Split View' : 'Split Compare'}</span>
        </button>
      </div>
    </div>
  );
};
