import React, { useRef, useEffect, useState } from 'react';
import { CurvePoint, CurvesState, calculateSplineLUT } from '../utils/imageProcess';

interface ToneCurvesProps {
  curves: CurvesState;
  theme: 'light' | 'dark';
  onChange: (channel: keyof CurvesState, points: CurvePoint[]) => void;
}

export const ToneCurves: React.FC<ToneCurvesProps> = ({ curves, theme, onChange }) => {
  const [activeChannel, setActiveChannel] = useState<keyof CurvesState>('rgb');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggedPointIdx, setDraggedPointIdx] = useState<number | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(0);
  const [histogram, setHistogram] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const points = curves[activeChannel];

  const presets = [
    { label: 'Linear / Reset', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    { label: 'Medium Contrast', points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.15 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.85 }, { x: 1, y: 1 }] },
    { label: 'Strong Contrast', points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.08 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.92 }, { x: 1, y: 1 }] },
    { label: 'Matte / Fade', points: [{ x: 0, y: 0.1 }, { x: 0.25, y: 0.2 }, { x: 0.75, y: 0.8 }, { x: 1, y: 0.9 }] },
    { label: 'Solarize / Peak', points: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }] },
    { label: 'Stepped Posterize', points: [{ x: 0, y: 0 }, { x: 0.33, y: 0 }, { x: 0.33, y: 0.5 }, { x: 0.66, y: 0.5 }, { x: 0.66, y: 1 }, { x: 1, y: 1 }] }
  ];

  const getChannelColor = (channel: keyof CurvesState) => {
    switch (channel) {
      case 'red': return '#D80000';
      case 'green': return '#00E676';
      case 'blue': return '#2979FF';
      default: return theme === 'dark' ? '#FFFFFF' : '#000000';
    }
  };

  useEffect(() => {
    if (draggedPointIdx !== null) return;
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 128;
      tempCanvas.height = 128;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(canvas, 0, 0, 128, 128);
      const imgData = tempCtx.getImageData(0, 0, 128, 128);
      const data = imgData.data;
      const hist = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        let val = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        if (activeChannel === 'red') val = data[i];
        else if (activeChannel === 'green') val = data[i+1];
        else if (activeChannel === 'blue') val = data[i+2];
        hist[val]++;
      }
      setHistogram(hist);
    } catch (e) {
      console.warn(e);
    }
  }, [curves, activeChannel, draggedPointIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    if (histogram.length > 0) {
      const maxVal = Math.max(...histogram);
      ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, size);
      for (let i = 0; i < 256; i++) {
        const xVal = (i / 255) * size;
        const hVal = (histogram[i] / maxVal) * size * 0.75;
        ctx.lineTo(xVal, size - hVal);
      }
      ctx.lineTo(size, size);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = theme === 'dark' ? '#262626' : '#E5E5E5';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const pos = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    ctx.strokeStyle = theme === 'dark' ? '#333333' : '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(size, 0);
    ctx.stroke();

    const lut = calculateSplineLUT(points);
    ctx.strokeStyle = getChannelColor(activeChannel);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const xVal = (i / 255) * size;
      const yVal = size - (lut[i] / 255) * size;
      if (i === 0) {
        ctx.moveTo(xVal, yVal);
      } else {
        ctx.lineTo(xVal, yVal);
      }
    }
    ctx.stroke();

    points.forEach((p, idx) => {
      ctx.fillStyle = selectedPointIdx === idx ? '#FF9100' : getChannelColor(activeChannel);
      ctx.beginPath();
      ctx.arc(p.x * size, size - p.y * size, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = theme === 'dark' ? '#000000' : '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x * size, size - p.y * size, 6, 0, 2 * Math.PI);
      ctx.stroke();
    });
  }, [points, activeChannel, draggedPointIdx, selectedPointIdx, histogram, theme]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;

    let foundIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.hypot(points[i].x - x, points[i].y - y);
      if (dist < 0.05) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      setDraggedPointIdx(foundIdx);
      setSelectedPointIdx(foundIdx);
    } else {
      const newPoints = [...points, { x, y }].sort((a, b) => a.x - b.x);
      const newIdx = newPoints.findIndex(p => p.x === x && p.y === y);
      onChange(activeChannel, newPoints);
      setDraggedPointIdx(newIdx);
      setSelectedPointIdx(newIdx);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedPointIdx === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = 1 - (e.clientY - rect.top) / rect.height;

    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const newPoints = [...points];
    const point = newPoints[draggedPointIdx];

    if (draggedPointIdx === 0) {
      point.y = y;
    } else if (draggedPointIdx === points.length - 1) {
      point.y = y;
    } else {
      const prevX = points[draggedPointIdx - 1].x;
      const nextX = points[draggedPointIdx + 1].x;
      point.x = Math.max(prevX + 0.005, Math.min(nextX - 0.005, x));
      point.y = y;
    }

    onChange(activeChannel, newPoints);
  };

  const handleMouseUp = () => {
    setDraggedPointIdx(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;

    let foundIdx = -1;
    for (let i = 1; i < points.length - 1; i++) {
      const dist = Math.hypot(points[i].x - x, points[i].y - y);
      if (dist < 0.05) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      const newPoints = points.filter((_, idx) => idx !== foundIdx);
      onChange(activeChannel, newPoints);
      setSelectedPointIdx(0);
      setDraggedPointIdx(null);
    }
  };

  return (
    <div className="curves-container" ref={containerRef}>
      <div className="curves-channels-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="curves-channels" style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {(['rgb', 'red', 'green', 'blue'] as const).map(ch => (
            <button
              key={ch}
              className={`channel-btn ${activeChannel === ch ? 'active' : ''} ${ch}`}
              onClick={() => {
                setActiveChannel(ch);
                setDraggedPointIdx(null);
                setSelectedPointIdx(0);
              }}
              style={{ flex: 1 }}
            >
              {ch === 'rgb' ? 'RGB' : ch[0].toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            onChange(activeChannel, [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
            setSelectedPointIdx(0);
          }}
          className="transform-btn"
          style={{ flex: 'none', marginLeft: '12px', padding: '6px 12px', fontSize: '9px', height: '24px', minHeight: 'unset' }}
        >
          Reset
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="curves-editor-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />

      <div className="curves-help" style={{ marginTop: '8px' }}>
        Click grid to add points. Drag to adjust. Double click to delete.
      </div>

      {selectedPointIdx !== null && points[selectedPointIdx] && (
        <div className="point-editor-container" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="transform-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px' }}>
            <span>Edit Point #{selectedPointIdx + 1}</span>
            {selectedPointIdx > 0 && selectedPointIdx < points.length - 1 && (
              <button
                onClick={() => {
                  const newPoints = points.filter((_, i) => i !== selectedPointIdx);
                  onChange(activeChannel, newPoints);
                  setSelectedPointIdx(0);
                }}
                className="transform-btn transform-btn-cancel"
                style={{ padding: '4px 10px', fontSize: '9px', height: '24px', minHeight: 'unset' }}
              >
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-name">Input (X)</span>
              <span className="slider-value">{Math.round(points[selectedPointIdx].x * 255)}</span>
            </div>
            <div className="slider-track-wrapper">
              <input
                type="range"
                className="slider-input"
                min="0"
                max="255"
                step="1"
                value={Math.round(points[selectedPointIdx].x * 255)}
                disabled={selectedPointIdx === 0 || selectedPointIdx === points.length - 1}
                onChange={(e) => {
                  const newX = parseInt(e.target.value) / 255;
                  const newPoints = [...points];
                  const prevX = points[selectedPointIdx - 1].x;
                  const nextX = points[selectedPointIdx + 1].x;
                  newPoints[selectedPointIdx].x = Math.max(prevX + 0.005, Math.min(nextX - 0.005, newX));
                  onChange(activeChannel, newPoints);
                }}
              />
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-name">Output (Y)</span>
              <span className="slider-value">{Math.round(points[selectedPointIdx].y * 255)}</span>
            </div>
            <div className="slider-track-wrapper">
              <input
                type="range"
                className="slider-input"
                min="0"
                max="255"
                step="1"
                value={Math.round(points[selectedPointIdx].y * 255)}
                onChange={(e) => {
                  const newY = parseInt(e.target.value) / 255;
                  const newPoints = [...points];
                  newPoints[selectedPointIdx].y = newY;
                  onChange(activeChannel, newPoints);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="curves-presets-container" style={{ marginTop: '20px' }}>
        <div className="transform-section-label">Curve Presets</div>
        <div className="preset-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {presets.map(p => (
            <div
              key={p.label}
              onClick={() => {
                onChange(activeChannel, p.points);
                setSelectedPointIdx(0);
              }}
              className="preset-card"
              style={{ padding: '10px 8px' }}
            >
              <div className="preset-name" style={{ fontSize: '9px' }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default ToneCurves;
