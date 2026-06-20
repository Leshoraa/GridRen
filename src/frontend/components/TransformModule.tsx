import React, { useState, useRef, useEffect } from 'react';

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
  onMaximizeCrop: () => void;
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
  onMaximizeCrop,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const aspectRatios = [
    { id: 'free', label: 'Freeform', icon: 'crop_free' },
    { id: '1:1', label: '1:1 Square', icon: 'crop_square' },
    { id: '16:9', label: '16:9 Cinematic', icon: 'crop_16_9' },
    { id: '4:3', label: '4:3 Standard', icon: 'crop_7_5' },
    { id: '3:2', label: '3:2 Classic', icon: 'crop_3_2' },
    { id: 'custom', label: 'Custom Ratio', icon: 'settings_overscan' },
  ];

  const currentOption = aspectRatios.find(r => r.id === cropAspectRatio) || aspectRatios[0];

  return (
    <div className="control-module active-module">
      <div className="module-title-clean">Transform</div>

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
            <div className="geometry-select-wrapper" ref={dropdownRef}>
              <div className="custom-dropdown-container">
                <div
                  className={`custom-dropdown-trigger ${dropdownOpen ? 'custom-dropdown-trigger-active' : ''}`}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined custom-dropdown-item-icon">{currentOption.icon}</span>
                    <span>{currentOption.label}</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>expand_more</span>
                </div>

                {dropdownOpen && (
                  <div className="custom-dropdown-menu">
                    {aspectRatios.map(opt => (
                      <div
                        key={opt.id}
                        className={`custom-dropdown-item ${cropAspectRatio === opt.id ? 'active' : ''}`}
                        onClick={() => {
                          setCropAspectRatio(opt.id);
                          setDropdownOpen(false);
                        }}
                      >
                        <span className="material-symbols-outlined custom-dropdown-item-icon">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

            <button
              className="transform-btn"
              onClick={onMaximizeCrop}
              title="Maximize Crop to Image Bounds"
              style={{ width: '100%', marginBottom: '10px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fullscreen</span>
              <span>Maximize Selection</span>
            </button>

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
