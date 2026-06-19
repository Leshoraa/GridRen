import React, { useRef, useEffect, useState } from 'react';
import { AdjustmentState, CurvesState, PresetType, processPixels } from '../utils/imageProcess';

export interface MaskData {
  id: string;
  name: string;
  type: 'brush' | 'radial' | 'linear';
  buffer: Uint8ClampedArray;
  visible: boolean;
  adjustments: AdjustmentState;
  curves: CurvesState;
}

interface CanvasWorkspaceProps {
  imageElement: HTMLImageElement | null;
  adjustments: AdjustmentState;
  curves: CurvesState;
  preset: PresetType;
  masks: MaskData[];
  activeMaskId: string | null;
  brushSize: number;
  brushFeather: number;
  brushOpacity: number;
  brushMode: 'add' | 'erase';
  onMaskUpdate: (maskId: string, buffer: Uint8ClampedArray) => void;
  onImageLoad: (img: HTMLImageElement, width: number, height: number) => void;
  showOverlay: boolean;
  uiCollapsed: boolean;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  imageElement,
  adjustments,
  curves,
  preset,
  masks,
  activeMaskId,
  brushSize,
  brushFeather,
  brushOpacity,
  brushMode,
  onMaskUpdate,
  onImageLoad,
  showOverlay,
  uiCollapsed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const [origPixels, setOrigPixels] = useState<Uint8ClampedArray | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(100);

  const activeMask = masks.find(m => m.id === activeMaskId);

  useEffect(() => {
    if (!imageElement) return;

    const maxDim = 900;
    let w = imageElement.naturalWidth;
    let h = imageElement.naturalHeight;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    setPreviewSize({ w, h });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(imageElement, 0, 0, w, h);
      const imgData = tempCtx.getImageData(0, 0, w, h);
      setOrigPixels(imgData.data);
      onImageLoad(imageElement, w, h);
    }
  }, [imageElement]);

  const getCanvasMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement || !activeMask) return;
    const coords = getCanvasMouseCoords(e);

    if (activeMask.type === 'brush') {
      setIsDrawing(true);
      drawBrushStroke(coords.x, coords.y);
    } else if (activeMask.type === 'radial' || activeMask.type === 'linear') {
      setDragStart(coords);
      setDragCurrent(coords);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement || !activeMask || !isDrawing) return;
    const coords = getCanvasMouseCoords(e);

    if (activeMask.type === 'brush') {
      drawBrushStroke(coords.x, coords.y);
    } else if ((activeMask.type === 'radial' || activeMask.type === 'linear') && dragStart) {
      setDragCurrent(coords);
      updateGeometryMask(dragStart, coords);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !activeMask) return;
    setIsDrawing(false);
    setDragStart(null);
    setDragCurrent(null);
    onMaskUpdate(activeMask.id, new Uint8ClampedArray(activeMask.buffer));
  };

  const drawBrushStroke = (cx: number, cy: number) => {
    if (!activeMask || !previewSize.w || !previewSize.h) return;

    const buffer = activeMask.buffer;
    const radius = brushSize;
    const hardness = 1 - brushFeather;
    const opacity = brushOpacity;
    const isErase = brushMode === 'erase';

    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(previewSize.w - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(previewSize.h - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);

        if (dist <= radius) {
          let factor = 1;
          if (dist > radius * hardness) {
            factor = 1 - (dist - radius * hardness) / (radius * (1 - hardness));
          }
          const delta = factor * opacity * 255;
          const idx = y * previewSize.w + x;

          if (isErase) {
            buffer[idx] = Math.max(0, buffer[idx] - delta);
          } else {
            buffer[idx] = Math.min(255, buffer[idx] + delta);
          }
        }
      }
    }

    draw();
  };

  const updateGeometryMask = (start: { x: number; y: number }, current: { x: number; y: number }) => {
    if (!activeMask || !previewSize.w || !previewSize.h) return;

    const buffer = activeMask.buffer;

    if (activeMask.type === 'radial') {
      const cx = start.x;
      const cy = start.y;
      const r = Math.hypot(current.x - cx, current.y - cy);

      if (r > 1) {
        const hardness = 1 - brushFeather;
        for (let y = 0; y < previewSize.h; y++) {
          for (let x = 0; x < previewSize.w; x++) {
            const dist = Math.hypot(x - cx, y - cy);
            let val = 0;
            if (dist <= r) {
              if (dist <= r * hardness) {
                val = 255;
              } else {
                val = 255 * (1 - (dist - r * hardness) / (r * (1 - hardness)));
              }
            }
            buffer[y * previewSize.w + x] = Math.round(val);
          }
        }
      }
    } else if (activeMask.type === 'linear') {
      const vx = current.x - start.x;
      const vy = current.y - start.y;
      const lenSq = vx * vx + vy * vy;

      if (lenSq > 10) {
        for (let y = 0; y < previewSize.h; y++) {
          for (let x = 0; x < previewSize.w; x++) {
            const px = x - start.x;
            const py = y - start.y;
            const t = (px * vx + py * vy) / lenSq;
            const val = 255 * Math.max(0, Math.min(1, 1 - t));
            buffer[y * previewSize.w + x] = Math.round(val);
          }
        }
      }
    }

    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !origPixels || !previewSize.w || !previewSize.h) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let processed = new Uint8ClampedArray(origPixels);

    masks.forEach(m => {
      if (m.visible && m.id !== activeMaskId) {
        processed = processPixels(processed, previewSize.w, previewSize.h, m.adjustments, m.curves, 'none', m.buffer);
      }
    });

    if (activeMask && activeMask.visible) {
      processed = processPixels(processed, previewSize.w, previewSize.h, adjustments, curves, preset, activeMask.buffer);
    } else if (!activeMaskId) {
      processed = processPixels(processed, previewSize.w, previewSize.h, adjustments, curves, preset, null);
    }

    const imgData = ctx.createImageData(previewSize.w, previewSize.h);

    if ((showOverlay || isDrawing) && activeMask && activeMask.visible) {
      const overlayColor = [216, 0, 0];
      for (let i = 0; i < processed.length; i += 4) {
        const maskVal = activeMask.buffer[i / 4] / 255;
        const blendWeight = maskVal * 0.4;
        imgData.data[i] = Math.round((1 - blendWeight) * processed[i] + blendWeight * overlayColor[0]);
        imgData.data[i + 1] = Math.round((1 - blendWeight) * processed[i + 1] + blendWeight * overlayColor[1]);
        imgData.data[i + 2] = Math.round((1 - blendWeight) * processed[i + 2] + blendWeight * overlayColor[2]);
        imgData.data[i + 3] = processed[i + 3];
      }
    } else {
      imgData.data.set(processed);
    }

    ctx.putImageData(imgData, 0, 0);

    if (isDrawing && activeMask) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;

      if (activeMask.type === 'radial' && dragStart && dragCurrent) {
        const cx = dragStart.x;
        const cy = dragStart.y;
        const r = Math.hypot(dragCurrent.x - cx, dragCurrent.y - cy);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 - brushFeather), 0, 2 * Math.PI);
        ctx.stroke();
      } else if (activeMask.type === 'linear' && dragStart && dragCurrent) {
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragCurrent.x, dragCurrent.y);
        ctx.stroke();

        const dx = dragCurrent.x - dragStart.x;
        const dy = dragCurrent.y - dragStart.y;
        const angle = Math.atan2(dy, dx);

        const perpAngle = angle + Math.PI / 2;
        const w = 100;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';

        ctx.beginPath();
        ctx.moveTo(dragStart.x - Math.cos(perpAngle) * w, dragStart.y - Math.sin(perpAngle) * w);
        ctx.lineTo(dragStart.x + Math.cos(perpAngle) * w, dragStart.y + Math.sin(perpAngle) * w);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(dragCurrent.x - Math.cos(perpAngle) * w, dragCurrent.y - Math.sin(perpAngle) * w);
        ctx.lineTo(dragCurrent.x + Math.cos(perpAngle) * w, dragCurrent.y + Math.sin(perpAngle) * w);
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    draw();
  }, [origPixels, adjustments, curves, preset, masks, activeMaskId, showOverlay, isDrawing, dragStart, dragCurrent]);

  const triggerFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = evt => {
          const img = new Image();
          img.onload = () => {
            onImageLoad(img, img.naturalWidth, img.naturalHeight);
          };
          img.src = evt.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = evt => {
        const img = new Image();
        img.onload = () => {
          onImageLoad(img, img.naturalWidth, img.naturalHeight);
        };
        img.src = evt.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (!imageElement) {
    return (
      <div
        className="start-screen"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="start-hero">
          <h1 className="start-title">GridRen</h1>
          <p className="start-tagline">
            Swiss design engineered photo editor. Direct canvas rendering with local masking controls.
          </p>
        </div>
        <div className="upload-zone" onClick={triggerFileSelect}>
          <div className="upload-text">Select or Drag Photo</div>
          <div className="upload-subtext">RAW, JPEG, PNG supported</div>
        </div>
      </div>
    );
  }

  const aspectRatio = previewSize.w && previewSize.h ? previewSize.w / previewSize.h : 1;
  const aspectRatioStr = previewSize.w && previewSize.h ? `${previewSize.w} / ${previewSize.h}` : 'auto';

  useEffect(() => {
    if (canvasContainerRef.current) {
      canvasContainerRef.current.style.setProperty('--aspect', String(aspectRatio));
    }
  }, [aspectRatio]);

  return (
    <div className="workspace-panel" ref={containerRef}>
      <div 
        ref={canvasContainerRef}
        className="canvas-container" 
        style={{ 
          aspectRatio: aspectRatioStr,
          transform: `scale(${(zoom / 100) * (uiCollapsed ? 1.05 : 1.0)})`
        }}
      >
        <canvas
          ref={canvasRef}
          width={previewSize.w}
          height={previewSize.h}
          className="editor-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      <div className="zoom-controls-floating">
        <button className="zoom-btn" onClick={() => setZoom(prev => Math.max(25, prev - 10))}>-</button>
        <span className="zoom-value">{zoom}%</span>
        <button className="zoom-btn" onClick={() => setZoom(prev => Math.min(200, prev + 10))}>+</button>
        <button className="zoom-btn" onClick={() => setZoom(100)}>Fit</button>
      </div>
    </div>
  );
};
