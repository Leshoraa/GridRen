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
  const containerRef = useRef<HTMLDivElement | null>(null);

  const points = curves[activeChannel];

  const getChannelColor = (channel: keyof CurvesState) => {
    switch (channel) {
      case 'red': return '#D80000';
      case 'green': return '#00E676';
      case 'blue': return '#2979FF';
      default: return theme === 'dark' ? '#FFFFFF' : '#000000';
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

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
      ctx.fillStyle = draggedPointIdx === idx ? '#D80000' : getChannelColor(activeChannel);
      ctx.beginPath();
      ctx.arc(p.x * size, size - p.y * size, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = theme === 'dark' ? '#000000' : '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x * size, size - p.y * size, 5, 0, 2 * Math.PI);
      ctx.stroke();
    });
  }, [points, activeChannel, draggedPointIdx, theme]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;

    let foundIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.hypot(points[i].x - x, points[i].y - y);
      if (dist < 0.04) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      setDraggedPointIdx(foundIdx);
    } else {
      const newPoints = [...points, { x, y }].sort((a, b) => a.x - b.x);
      const newIdx = newPoints.findIndex(p => p.x === x && p.y === y);
      onChange(activeChannel, newPoints);
      setDraggedPointIdx(newIdx);
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
      point.x = Math.max(prevX + 0.01, Math.min(nextX - 0.01, x));
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
      if (dist < 0.04) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      const newPoints = points.filter((_, idx) => idx !== foundIdx);
      onChange(activeChannel, newPoints);
      setDraggedPointIdx(null);
    }
  };

  return (
    <div className="curves-container" ref={containerRef}>
      <div className="curves-channels">
        {(['rgb', 'red', 'green', 'blue'] as const).map(ch => (
          <button
            key={ch}
            className={`channel-btn ${activeChannel === ch ? 'active' : ''} ${ch}`}
            onClick={() => {
              setActiveChannel(ch);
              setDraggedPointIdx(null);
            }}
          >
            {ch === 'rgb' ? 'RGB' : ch[0]}
          </button>
        ))}
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
      <div className="curves-help">
        Click grid to add points. Drag to adjust. Double click to delete.
      </div>
    </div>
  );
};
