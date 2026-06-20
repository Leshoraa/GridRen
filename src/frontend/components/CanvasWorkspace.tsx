import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { AdjustmentState, CurvesState, PresetType } from '../utils/imageProcess';
import { renderFullPipeline, computeGeometryAsync } from '../utils/imageProcessWorker';

export interface MaskData {
  id: string;
  name: string;
  type: 'brush' | 'radial' | 'linear';
  buffer: Uint8ClampedArray;
  visible: boolean;
  adjustments: AdjustmentState;
  curves: CurvesState;
}

export interface CanvasWorkspaceHandle {
  liveRedraw: (adj: AdjustmentState, crv: CurvesState, pre: PresetType) => void;
  getOrigPixels: () => Uint8ClampedArray | null;
  setOrigPixels: (pixels: Uint8ClampedArray, w: number, h: number) => void;
  getCurrentCropRect: () => { x: number; y: number; w: number; h: number } | null;
  maximizeCropRect: () => void;
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
  onImageLoad: (img: HTMLImageElement, width: number, height: number, pixels?: Uint8ClampedArray) => void;
  showOverlay: boolean;
  uiCollapsed: boolean;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  splitRatio: number | null;
  setSplitRatio: (ratio: number | null) => void;
  cropMode: boolean;
  cropAspectRatio: string;
  customRatioW: number;
  customRatioH: number;
  isComparing?: boolean;
  isEraserMode?: boolean;
  eraserBuffer?: Uint8ClampedArray | null;
  onEraserMaskUpdate?: (hasPixels: boolean) => void;
}


export const CanvasWorkspace = forwardRef<CanvasWorkspaceHandle, CanvasWorkspaceProps>((props, ref) => {
  const {
    imageElement, adjustments, curves, preset, masks, activeMaskId,
    brushSize, brushFeather, brushOpacity, brushMode,
    onMaskUpdate, onImageLoad, showOverlay, uiCollapsed,
    zoom, pan, setPan, splitRatio, setSplitRatio,
    cropMode, cropAspectRatio, customRatioW, customRatioH,
    isComparing, isEraserMode, eraserBuffer, onEraserMaskUpdate,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const origPixelsRef = useRef<Uint8ClampedArray | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panOffsetStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const renderRafRef = useRef<number | null>(null);
  const isRenderingRef = useRef(false);
  const pendingRenderRef = useRef(false);

  const liveAdjRef = useRef<AdjustmentState>(adjustments);
  const liveCrvRef = useRef<CurvesState>(curves);
  const livePreRef = useRef<PresetType>(preset);
  const liveMasksRef = useRef<MaskData[]>(masks);
  const liveActiveMaskIdRef = useRef<string | null>(activeMaskId);
  const liveShowOverlayRef = useRef(showOverlay);
  const liveSplitRatioRef = useRef(splitRatio);

  const brushRafRef = useRef<number | null>(null);
  const pendingBrushCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const isDrawingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { liveAdjRef.current = adjustments; }, [adjustments]);
  useEffect(() => { liveCrvRef.current = curves; }, [curves]);
  useEffect(() => { livePreRef.current = preset; }, [preset]);
  useEffect(() => { liveMasksRef.current = masks; }, [masks]);
  useEffect(() => { liveActiveMaskIdRef.current = activeMaskId; }, [activeMaskId]);
  useEffect(() => { liveShowOverlayRef.current = showOverlay; }, [showOverlay]);
  useEffect(() => { liveSplitRatioRef.current = splitRatio; }, [splitRatio]);
  const liveIsComparingRef = useRef(false);
  useEffect(() => { liveIsComparingRef.current = isComparing || false; scheduleRender(); }, [isComparing]);
  const liveIsEraserModeRef = useRef(false);
  useEffect(() => { liveIsEraserModeRef.current = isEraserMode || false; scheduleRender(); }, [isEraserMode]);
  const liveEraserBufferRef = useRef<Uint8ClampedArray | null>(null);
  useEffect(() => { liveEraserBufferRef.current = eraserBuffer || null; scheduleRender(); }, [eraserBuffer]);
  const cachedProcessedRef = useRef<Uint8ClampedArray | null>(null);
  const lastProcessedKeyRef = useRef<string>('');

  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useImperativeHandle(ref, () => ({
    liveRedraw: (adj, crv, pre) => {
      liveAdjRef.current = adj;
      liveCrvRef.current = crv;
      livePreRef.current = pre;
      scheduleRender();
    },
    getOrigPixels: () => origPixelsRef.current,
    setOrigPixels: (pixels, w, h) => {
      origPixelsRef.current = pixels;
      setPreviewSize({ w, h });
      cachedProcessedRef.current = null;
      lastProcessedKeyRef.current = '';
      scheduleRender();
    },
    getCurrentCropRect: () => cropRect,
    maximizeCropRect: () => {
      if (!previewSize.w || !previewSize.h) return;
      let ratio = 1;
      let lockRatio = false;
      if (cropAspectRatio === 'free') {
        lockRatio = false;
      } else {
        lockRatio = true;
        if (cropAspectRatio === '1:1') ratio = 1;
        else if (cropAspectRatio === '16:9') ratio = 16 / 9;
        else if (cropAspectRatio === '4:3') ratio = 4 / 3;
        else if (cropAspectRatio === '3:2') ratio = 3 / 2;
        else if (cropAspectRatio === 'custom') {
          ratio = customRatioW / customRatioH;
        }
      }

      const canvasW = previewSize.w;
      const canvasH = previewSize.h;
      const canvasRatio = canvasW / canvasH;

      let cropW = canvasW;
      let cropH = canvasH;

      if (lockRatio) {
        if (ratio > canvasRatio) {
          cropW = canvasW;
          cropH = cropW / ratio;
        } else {
          cropH = canvasH;
          cropW = cropH * ratio;
        }
      }

      setCropRect({
        x: Math.round((canvasW - cropW) / 2),
        y: Math.round((canvasH - cropH) / 2),
        w: Math.round(cropW),
        h: Math.round(cropH),
      });
    },
  }), [cropRect, previewSize, cropAspectRatio, customRatioW, customRatioH]);



  useEffect(() => {
    if (!cropMode || !previewSize.w || !previewSize.h) {
      setCropRect(null);
      return;
    }

    let ratio = 1;
    let lockRatio = false;
    if (cropAspectRatio === 'free') {
      lockRatio = false;
    } else {
      lockRatio = true;
      if (cropAspectRatio === '1:1') ratio = 1;
      else if (cropAspectRatio === '16:9') ratio = 16 / 9;
      else if (cropAspectRatio === '4:3') ratio = 4 / 3;
      else if (cropAspectRatio === '3:2') ratio = 3 / 2;
      else if (cropAspectRatio === 'custom') {
        ratio = customRatioW / customRatioH;
      }
    }

    const canvasW = previewSize.w;
    const canvasH = previewSize.h;
    const canvasRatio = canvasW / canvasH;

    let cropW = canvasW;
    let cropH = canvasH;

    if (lockRatio) {
      if (ratio > canvasRatio) {
        cropW = canvasW;
        cropH = cropW / ratio;
      } else {
        cropH = canvasH;
        cropW = cropH * ratio;
      }
    } else {
      cropW = canvasW;
      cropH = canvasH;
    }

    const cropX = (canvasW - cropW) / 2;
    const cropY = (canvasH - cropH) / 2;

    setCropRect({
      x: Math.round(cropX),
      y: Math.round(cropY),
      w: Math.round(cropW),
      h: Math.round(cropH),
    });
  }, [cropMode, cropAspectRatio, customRatioW, customRatioH, previewSize]);

  const handleCropMouseDown = (
    action: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br',
    e: React.MouseEvent
  ) => {
    if (e.button === 1 || isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { ...pan };

      const handlePanMouseMove = (moveEvent: MouseEvent) => {
        setPan({
          x: panOffsetStartRef.current!.x + moveEvent.clientX - panStartRef.current!.x,
          y: panOffsetStartRef.current!.y + moveEvent.clientY - panStartRef.current!.y,
        });
      };

      const handlePanMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
        panOffsetStartRef.current = null;
        window.removeEventListener('mousemove', handlePanMouseMove);
        window.removeEventListener('mouseup', handlePanMouseUp);
      };

      window.addEventListener('mousemove', handlePanMouseMove);
      window.addEventListener('mouseup', handlePanMouseUp);
      return;
    }

    e.preventDefault();
    if (!cropRect) return;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startRect = { ...cropRect };

    const canvas = canvasRef.current;
    const canvasBounds = canvas ? canvas.getBoundingClientRect() : null;
    const cssToPixelX = canvasBounds ? previewSize.w / canvasBounds.width : 1;
    const cssToPixelY = canvasBounds ? previewSize.h / canvasBounds.height : 1;

    let ratio = 1;
    let lockRatio = false;
    if (cropAspectRatio === 'free') {
      lockRatio = false;
    } else {
      lockRatio = true;
      if (cropAspectRatio === '1:1') ratio = 1;
      else if (cropAspectRatio === '16:9') ratio = 16 / 9;
      else if (cropAspectRatio === '4:3') ratio = 4 / 3;
      else if (cropAspectRatio === '3:2') ratio = 3 / 2;
      else if (cropAspectRatio === 'custom') {
        ratio = customRatioW / customRatioH;
      }
    }

    const minW = 30;
    const minH = minW / (lockRatio ? ratio : 1);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startMouseX) * cssToPixelX;
      const dy = (moveEvent.clientY - startMouseY) * cssToPixelY;

      const canvasW = previewSize.w;
      const canvasH = previewSize.h;

      let newX = startRect.x;
      let newY = startRect.y;
      let newW = startRect.w;
      let newH = startRect.h;

      if (action === 'move') {
        newX = Math.max(0, Math.min(canvasW - startRect.w, startRect.x + dx));
        newY = Math.max(0, Math.min(canvasH - startRect.h, startRect.y + dy));
      } else if (lockRatio) {
        if (action === 'resize-br') {
          const maxW = canvasW - startRect.x;
          const maxH = canvasH - startRect.y;
          newW = Math.min(startRect.w + dx, maxW, maxH * ratio);
          newW = Math.max(minW, newW);
          newH = newW / ratio;
          newX = startRect.x;
          newY = startRect.y;
        } else if (action === 'resize-tr') {
          const bottomY = startRect.y + startRect.h;
          newW = Math.min(startRect.w + dx, canvasW - startRect.x, bottomY * ratio);
          newW = Math.max(minW, newW);
          newH = newW / ratio;
          newY = bottomY - newH;
          newX = startRect.x;
        } else if (action === 'resize-bl') {
          const rightX = startRect.x + startRect.w;
          newW = Math.min(startRect.w - dx, rightX, (canvasH - startRect.y) * ratio);
          newW = Math.max(minW, newW);
          newH = newW / ratio;
          newX = rightX - newW;
          newY = startRect.y;
        } else if (action === 'resize-tl') {
          const rightX = startRect.x + startRect.w;
          const bottomY = startRect.y + startRect.h;
          newW = Math.min(startRect.w - dx, rightX, bottomY * ratio);
          newW = Math.max(minW, newW);
          newH = newW / ratio;
          newX = rightX - newW;
          newY = bottomY - newH;
        }
      } else {
        if (action === 'resize-br') {
          newW = Math.max(minW, Math.min(startRect.w + dx, canvasW - startRect.x));
          newH = Math.max(minH, Math.min(startRect.h + dy, canvasH - startRect.y));
          newX = startRect.x;
          newY = startRect.y;
        } else if (action === 'resize-tr') {
          newW = Math.max(minW, Math.min(startRect.w + dx, canvasW - startRect.x));
          newH = Math.max(minH, Math.min(startRect.h - dy, startRect.y + startRect.h));
          newY = startRect.y + startRect.h - newH;
          newX = startRect.x;
        } else if (action === 'resize-bl') {
          newW = Math.max(minW, Math.min(startRect.w - dx, startRect.x + startRect.w));
          newH = Math.max(minH, Math.min(startRect.h + dy, canvasH - startRect.y));
          newX = startRect.x + startRect.w - newW;
          newY = startRect.y;
        } else if (action === 'resize-tl') {
          newW = Math.max(minW, Math.min(startRect.w - dx, startRect.x + startRect.w));
          newH = Math.max(minH, Math.min(startRect.h - dy, startRect.y + startRect.h));
          newX = startRect.x + startRect.w - newW;
          newY = startRect.y + startRect.h - newH;
        }
      }

      setCropRect({
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    const handleBlur = () => { setIsSpacePressed(false); setIsPanning(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const getCursorStyle = () => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed) return 'grab';
    if (splitRatio !== null) return 'ew-resize';
    if (!activeMaskId) return 'grab';
    return 'crosshair';
  };

  const activeMask = masks.find(m => m.id === activeMaskId);

  useEffect(() => {
    if (!imageElement) return;
    const maxDim = 900;
    let w = imageElement.naturalWidth;
    let h = imageElement.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
      else { w = Math.round((w * maxDim) / h); h = maxDim; }
    }
    setPreviewSize({ w, h });
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) {
      tmpCtx.drawImage(imageElement, 0, 0, w, h);
      const data = tmpCtx.getImageData(0, 0, w, h).data;
      origPixelsRef.current = new Uint8ClampedArray(data);
      onImageLoad(imageElement, w, h, new Uint8ClampedArray(data));
    }
  }, [imageElement]);

  const paintToCanvas = useCallback((
    processed: Uint8ClampedArray,
    pw: number, ph: number,
    activeMaskData: MaskData | undefined,
    showOv: boolean, drawing: boolean,
    splitR: number | null,
    ds: { x: number; y: number } | null,
    dc: { x: number; y: number } | null,
    isEraserVal: boolean,
    eraserBufVal: Uint8ClampedArray | null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const imgData = ctx.createImageData(pw, ph);

    if ((showOv || drawing) && activeMaskData && activeMaskData.visible) {
      for (let i = 0; i < processed.length; i += 4) {
        const mw = activeMaskData.buffer[i / 4] / 255 * 0.4;
        imgData.data[i] = Math.round((1 - mw) * processed[i] + mw * 216);
        imgData.data[i + 1] = Math.round((1 - mw) * processed[i + 1]);
        imgData.data[i + 2] = Math.round((1 - mw) * processed[i + 2]);
        imgData.data[i + 3] = processed[i + 3];
      }
    } else if (isEraserVal && eraserBufVal) {
      for (let i = 0; i < processed.length; i += 4) {
        const ew = eraserBufVal[i / 4] / 255 * 0.55;
        imgData.data[i] = Math.round((1 - ew) * processed[i] + ew * 255);
        imgData.data[i + 1] = Math.round((1 - ew) * processed[i + 1] + ew * 110);
        imgData.data[i + 2] = Math.round((1 - ew) * processed[i + 2]);
        imgData.data[i + 3] = processed[i + 3];
      }
    } else {
      imgData.data.set(processed);
    }

    if (splitR !== null && origPixelsRef.current) {
      const splitLimit = Math.round(pw * splitR);
      const orig = origPixelsRef.current;
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < splitLimit; x++) {
          const idx = (y * pw + x) * 4;
          imgData.data[idx] = orig[idx];
          imgData.data[idx + 1] = orig[idx + 1];
          imgData.data[idx + 2] = orig[idx + 2];
          imgData.data[idx + 3] = orig[idx + 3];
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    if (splitR !== null) {
      const splitLimit = Math.round(pw * splitR);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(splitLimit, 0); ctx.lineTo(splitLimit, ph); ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(splitLimit, ph / 2, 12, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = '10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◂▸', splitLimit, ph / 2);
    }

    if (drawing && activeMaskData) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      if (activeMaskData.type === 'radial' && ds && dc) {
        const r = Math.hypot(dc.x - ds.x, dc.y - ds.y);
        ctx.beginPath(); ctx.arc(ds.x, ds.y, r, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(ds.x, ds.y, r * (1 - brushFeather), 0, 2 * Math.PI); ctx.stroke();
      } else if (activeMaskData.type === 'linear' && ds && dc) {
        ctx.beginPath(); ctx.moveTo(ds.x, ds.y); ctx.lineTo(dc.x, dc.y); ctx.stroke();
        const angle = Math.atan2(dc.y - ds.y, dc.x - ds.x) + Math.PI / 2;
        const w2 = 100;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.moveTo(ds.x - Math.cos(angle) * w2, ds.y - Math.sin(angle) * w2); ctx.lineTo(ds.x + Math.cos(angle) * w2, ds.y + Math.sin(angle) * w2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.moveTo(dc.x - Math.cos(angle) * w2, dc.y - Math.sin(angle) * w2); ctx.lineTo(dc.x + Math.cos(angle) * w2, dc.y + Math.sin(angle) * w2); ctx.stroke();
      }
    }
  }, [brushFeather]);

  const doRender = useCallback(async () => {
    const orig = origPixelsRef.current;
    const ps = previewSize;
    if (!orig || !ps.w || !ps.h) return;
    if (isRenderingRef.current) { pendingRenderRef.current = true; return; }

    isRenderingRef.current = true;
    pendingRenderRef.current = false;

    const adj = liveAdjRef.current;
    const crv = liveCrvRef.current;
    const pre = livePreRef.current;
    const msk = liveMasksRef.current;
    const amid = liveActiveMaskIdRef.current;
    const showOv = liveShowOverlayRef.current;
    const splitR = liveSplitRatioRef.current;
    const drawing = isDrawingRef.current;
    const ds = dragStartRef.current;
    const dc = dragCurrentRef.current;
    const isEraser = liveIsEraserModeRef.current;
    const eraserBuf = liveEraserBufferRef.current;

    const isComp = liveIsComparingRef.current;
    let result = null;
    const cacheKey = `${pre}_${JSON.stringify(adj)}_${JSON.stringify(crv)}_${msk.map(m => m.id + "_" + m.visible).join(',')}_${amid}`;
    
    if (isEraser && cachedProcessedRef.current && lastProcessedKeyRef.current === cacheKey) {
      result = cachedProcessedRef.current;
    } else {
      result = isComp ? orig : await renderFullPipeline(orig, ps.w, ps.h, adj, crv, pre, msk, amid);
      if (result && !isComp) {
        cachedProcessedRef.current = result;
        lastProcessedKeyRef.current = cacheKey;
      }
    }

    isRenderingRef.current = false;

    if (!result) {
      if (pendingRenderRef.current) scheduleRender();
      return;
    }

    const curActiveMask = msk.find(m => m.id === amid);
    paintToCanvas(
      result,
      ps.w,
      ps.h,
      isComp ? undefined : curActiveMask,
      isComp ? false : showOv,
      isComp ? false : drawing,
      isComp ? null : splitR,
      isComp ? null : ds,
      isComp ? null : dc,
      isComp ? false : isEraser,
      isComp ? null : eraserBuf
    );

    if (pendingRenderRef.current) scheduleRender();
  }, [previewSize, paintToCanvas]);

  const scheduleRender = useCallback(() => {
    if (renderRafRef.current) cancelAnimationFrame(renderRafRef.current);
    renderRafRef.current = requestAnimationFrame(() => {
      renderRafRef.current = null;
      doRender();
    });
  }, [doRender]);

  useEffect(() => {
    scheduleRender();
  }, [adjustments, curves, preset, masks, activeMaskId, showOverlay, splitRatio, previewSize, isComparing]);

  const getCanvasMouseCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const applyBrushStroke = useCallback((cx: number, cy: number) => {
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
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= radius) {
          let factor = dist > radius * hardness ? 1 - (dist - radius * hardness) / (radius * (1 - hardness)) : 1;
          const delta = factor * opacity * 255;
          const idx = y * previewSize.w + x;
          buffer[idx] = isErase ? Math.max(0, buffer[idx] - delta) : Math.min(255, buffer[idx] + delta);
        }
      }
    }
  }, [activeMask, previewSize, brushSize, brushFeather, brushOpacity, brushMode]);

  const applyEraserBrushStroke = useCallback((cx: number, cy: number) => {
    if (!eraserBuffer || !previewSize.w || !previewSize.h) return;
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
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= radius) {
          let factor = dist > radius * hardness ? 1 - (dist - radius * hardness) / (radius * (1 - hardness)) : 1;
          const delta = factor * opacity * 255;
          const idx = y * previewSize.w + x;
          eraserBuffer[idx] = isErase ? Math.max(0, eraserBuffer[idx] - delta) : Math.min(255, eraserBuffer[idx] + delta);
        }
      }
    }
  }, [eraserBuffer, previewSize, brushSize, brushFeather, brushOpacity, brushMode]);

  const flushBrushRaf = useCallback(() => {
    brushRafRef.current = null;
    const coords = pendingBrushCoordsRef.current;
    if (!coords) return;
    pendingBrushCoordsRef.current = null;
    if (liveIsEraserModeRef.current) {
      applyEraserBrushStroke(coords.x, coords.y);
    } else {
      applyBrushStroke(coords.x, coords.y);
    }
    scheduleRender();
  }, [applyBrushStroke, applyEraserBrushStroke, scheduleRender]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement) return;

    if (splitRatio !== null) {
      const coords = getCanvasMouseCoords(e);
      if (Math.abs(coords.x - Math.round(previewSize.w * splitRatio)) < 24) {
        setIsDraggingSplit(true);
        return;
      }
    }

    const shouldPan = isSpacePressed || e.button === 1 || (!activeMask && !liveIsEraserModeRef.current);
    if (shouldPan) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { ...pan };
      if (e.button === 1) e.preventDefault();
      return;
    }

    if (!activeMask && !liveIsEraserModeRef.current) return;
    const coords = getCanvasMouseCoords(e);

    if (liveIsEraserModeRef.current) {
      setIsDrawing(true);
      isDrawingRef.current = true;
      applyEraserBrushStroke(coords.x, coords.y);
      scheduleRender();
    } else if (activeMask && activeMask.type === 'brush') {
      setIsDrawing(true);
      isDrawingRef.current = true;
      applyBrushStroke(coords.x, coords.y);
      scheduleRender();
    } else if (activeMask && (activeMask.type === 'radial' || activeMask.type === 'linear')) {
      dragStartRef.current = coords;
      dragCurrentRef.current = coords;
      setDragStart(coords);
      setDragCurrent(coords);
      setIsDrawing(true);
      isDrawingRef.current = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement) return;

    if (isDraggingSplit && splitRatio !== null) {
      const coords = getCanvasMouseCoords(e);
      setSplitRatio(Math.max(0, Math.min(1, coords.x / previewSize.w)));
      return;
    }

    if (isPanning && panStartRef.current && panOffsetStartRef.current) {
      setPan({
        x: panOffsetStartRef.current.x + e.clientX - panStartRef.current.x,
        y: panOffsetStartRef.current.y + e.clientY - panStartRef.current.y,
      });
      return;
    }

    if ((!activeMask && !liveIsEraserModeRef.current) || !isDrawing) return;
    const coords = getCanvasMouseCoords(e);

    if (liveIsEraserModeRef.current) {
      pendingBrushCoordsRef.current = coords;
      if (!brushRafRef.current) {
        brushRafRef.current = requestAnimationFrame(flushBrushRaf);
      }
    } else if (activeMask && activeMask.type === 'brush') {
      pendingBrushCoordsRef.current = coords;
      if (!brushRafRef.current) {
        brushRafRef.current = requestAnimationFrame(flushBrushRaf);
      }
    } else if (activeMask && (activeMask.type === 'radial' || activeMask.type === 'linear') && dragStartRef.current) {
      dragCurrentRef.current = coords;
      setDragCurrent(coords);

      if (!brushRafRef.current) {
        brushRafRef.current = requestAnimationFrame(() => {
          brushRafRef.current = null;
          const ds = dragStartRef.current;
          const dc = dragCurrentRef.current;
          if (!ds || !dc) return;
          computeGeometryAsync(
            activeMask.type as 'radial' | 'linear',
            previewSize.w, previewSize.h,
            ds.x, ds.y, dc.x, dc.y, brushFeather
          ).then(buf => {
            if (buf && activeMask.buffer.length === buf.length) {
              activeMask.buffer.set(buf);
              scheduleRender();
            }
          });
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDraggingSplit) { setIsDraggingSplit(false); return; }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      panOffsetStartRef.current = null;
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    isDrawingRef.current = false;
    setDragStart(null);
    setDragCurrent(null);
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    if (brushRafRef.current) { cancelAnimationFrame(brushRafRef.current); brushRafRef.current = null; }
    if (activeMask) {
      onMaskUpdate(activeMask.id, new Uint8ClampedArray(activeMask.buffer));
    }
    if (liveIsEraserModeRef.current && eraserBuffer) {
      let hasPixels = false;
      for (let i = 0; i < eraserBuffer.length; i++) {
        if (eraserBuffer[i] > 128) {
          hasPixels = true;
          break;
        }
      }
      onEraserMaskUpdate?.(hasPixels);
    }
    scheduleRender();
  };

  const aspectRatio = previewSize.w && previewSize.h ? previewSize.w / previewSize.h : 1;
  const aspectRatioStr = previewSize.w && previewSize.h ? `${previewSize.w} / ${previewSize.h}` : 'auto';

  useEffect(() => {
    canvasContainerRef.current?.style.setProperty('--aspect', String(aspectRatio));
  }, [aspectRatio]);

  const triggerFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        const img = new Image();
        img.onload = () => onImageLoad(img, img.naturalWidth, img.naturalHeight);
        img.src = evt.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => onImageLoad(img, img.naturalWidth, img.naturalHeight);
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!imageElement) {
    return (
      <div className="start-screen" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        <div className="start-hero">
          <h1 className="start-title">GridRen</h1>
          <p className="start-tagline">Swiss design engineered photo editor. Direct canvas rendering with local masking controls.</p>
        </div>
        <div className="upload-zone" onClick={triggerFileSelect}>
          <div className="upload-text">Select or Drag Photo</div>
          <div className="upload-subtext">RAW, JPEG, PNG supported</div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-panel" ref={containerRef}>
      <div
        ref={canvasContainerRef}
        className={`canvas-container${uiCollapsed ? ' collapsed' : ''}`}
        style={{
          aspectRatio: aspectRatioStr,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
          transition: isPanning ? 'none' : undefined,
        }}
      >
        <canvas
          ref={canvasRef}
          width={previewSize.w}
          height={previewSize.h}
          className="editor-canvas"
          style={{ cursor: getCursorStyle() }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {cropMode && cropRect && previewSize.w > 0 && previewSize.h > 0 && (
          <div
            className="crop-overlay"
            style={{ pointerEvents: (isSpacePressed || isPanning) ? 'none' : 'auto' }}
          >
            <div
              className="crop-box"
              style={{
                left: `${(cropRect.x / previewSize.w) * 100}%`,
                top: `${(cropRect.y / previewSize.h) * 100}%`,
                width: `${(cropRect.w / previewSize.w) * 100}%`,
                height: `${(cropRect.h / previewSize.h) * 100}%`,
              }}
              onMouseDown={e => handleCropMouseDown('move', e)}
            >
              <div className="crop-grid-line-h1" />
              <div className="crop-grid-line-h2" />
              <div className="crop-grid-line-v1" />
              <div className="crop-grid-line-v2" />

              <div
                className="crop-handle crop-handle-tl"
                onMouseDown={e => { e.stopPropagation(); handleCropMouseDown('resize-tl', e); }}
              />
              <div
                className="crop-handle crop-handle-tr"
                onMouseDown={e => { e.stopPropagation(); handleCropMouseDown('resize-tr', e); }}
              />
              <div
                className="crop-handle crop-handle-bl"
                onMouseDown={e => { e.stopPropagation(); handleCropMouseDown('resize-bl', e); }}
              />
              <div
                className="crop-handle crop-handle-br"
                onMouseDown={e => { e.stopPropagation(); handleCropMouseDown('resize-br', e); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
