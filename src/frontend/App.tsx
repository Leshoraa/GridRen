import React, { useState, useEffect, useRef } from 'react';
import { CanvasWorkspace, MaskData, CanvasWorkspaceHandle } from './components/CanvasWorkspace';
import { AppHeader } from './components/AppHeader';
import { PresetsModule } from './components/PresetsModule';
import { AdjustmentSliders } from './components/AdjustmentSliders';
import { ColorMixerModule } from './components/ColorMixerModule';
import { ColorGradingModule } from './components/ColorGradingModule';
import { DetailModule } from './components/DetailModule';
import { CurvesModule } from './components/CurvesModule';
import { MasksModule } from './components/MasksModule';
import { TransformModule } from './components/TransformModule';
import { SidebarTabs, TabType } from './components/SidebarTabs';
import { CreativeEffectsModule } from './components/CreativeEffectsModule';
import { LensModule } from './components/LensModule';
import { EraserModule } from './components/EraserModule';
import { AdjustmentState, CurvePoint, CurvesState, PresetType, processPixels, applyInpaint, applyPatchMatch, countMaskPixels } from './utils/imageProcess';
const initialAdjustments = (): AdjustmentState => ({
  exposure: 0,
  contrast: 1,
  saturation: 1,
  highlights: 0,
  shadows: 0,
  bloomThreshold: 0.8,
  bloomIntensity: 0,
  bloomRadius: 15,
  bloomColor: null,
  temperature: 0,
  tint: 0,
  grainIntensity: 0,
  grainSize: 1,
  vignetteIntensity: 0,
  chromaticAberration: 0,

  clarity: 0,
  dehaze: 0,
  sharpening: 0,
  denoise: 0,

  colorGradingBalance: 0,
  colorGradingShadowsHue: 0,
  colorGradingShadowsSat: 0,
  colorGradingMidtonesHue: 0,
  colorGradingMidtonesSat: 0,
  colorGradingHighlightsHue: 0,
  colorGradingHighlightsSat: 0,

  hslHueRed: 0,
  hslSatRed: 0,
  hslLumRed: 0,
  hslHueOrange: 0,
  hslSatOrange: 0,
  hslLumOrange: 0,
  hslHueYellow: 0,
  hslSatYellow: 0,
  hslLumYellow: 0,
  hslHueGreen: 0,
  hslSatGreen: 0,
  hslLumGreen: 0,
  hslHueAqua: 0,
  hslSatAqua: 0,
  hslLumAqua: 0,
  hslHueBlue: 0,
  hslSatBlue: 0,
  hslLumBlue: 0,
  hslHuePurple: 0,
  hslSatPurple: 0,
  hslLumPurple: 0,
  hslHueMagenta: 0,
  hslSatMagenta: 0,
  hslLumMagenta: 0,

  vibrance: 0,
  whites: 0,
  blacks: 0,
  gamma: 1.0,
  fade: 0,

  texture: 0,
  sharpeningRadius: 1.0,
  denoiseDetail: 0.5,
  defringe: 0,

  halationIntensity: 0,
  halationThreshold: 0.8,
  halationRadius: 8,
  mistIntensity: 0,

  glitchSplit: 0,
  glitchBlock: 0,

  colorLeakIntensity: 0,
  colorLeakHue: 15,

  duoShadowHue: 220,
  duoShadowSat: 0.5,
  duoHighlightHue: 40,
  duoHighlightSat: 0.5,
  duoMix: 0,

  sepia: 0,
  solarize: 0,
  posterize: 64,
  thermal: 0,
  crossProcess: 0,

  vignetteFeather: 0.5,
  vignetteRoundness: 0.5,

  grainChroma: 0,

  fisheye: 0,
  distortion: 0,

  borderWidth: 0,
  borderHue: 0,
});

const initialCurves = (): CurvesState => ({
  rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
});

interface HistoryState {
  globalAdjustments: AdjustmentState;
  globalCurves: CurvesState;
  globalPreset: PresetType;
  masks: MaskData[];
  activeMaskId: string | null;
  origPixels: Uint8ClampedArray;
  previewW: number;
  previewH: number;
}

const rotatePixelsCW = (pixels: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const destX = h - 1 - y;
      const destY = x;
      const destIdx = (destY * h + destX) * 4;
      dest[destIdx] = pixels[srcIdx];
      dest[destIdx + 1] = pixels[srcIdx + 1];
      dest[destIdx + 2] = pixels[srcIdx + 2];
      dest[destIdx + 3] = pixels[srcIdx + 3];
    }
  }
  return dest;
};

const rotatePixelsCCW = (pixels: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const destX = y;
      const destY = w - 1 - x;
      const destIdx = (destY * h + destX) * 4;
      dest[destIdx] = pixels[srcIdx];
      dest[destIdx + 1] = pixels[srcIdx + 1];
      dest[destIdx + 2] = pixels[srcIdx + 2];
      dest[destIdx + 3] = pixels[srcIdx + 3];
    }
  }
  return dest;
};

const flipPixelsH = (pixels: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const destIdx = (y * w + (w - 1 - x)) * 4;
      dest[destIdx] = pixels[srcIdx];
      dest[destIdx + 1] = pixels[srcIdx + 1];
      dest[destIdx + 2] = pixels[srcIdx + 2];
      dest[destIdx + 3] = pixels[srcIdx + 3];
    }
  }
  return dest;
};

const flipPixelsV = (pixels: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < h; y++) {
    const srcRowIdx = y * w * 4;
    const destRowIdx = (h - 1 - y) * w * 4;
    dest.set(pixels.subarray(srcRowIdx, srcRowIdx + w * 4), destRowIdx);
  }
  return dest;
};

const rotateMaskCW = (mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dest[x * h + (h - 1 - y)] = mask[y * w + x];
    }
  }
  return dest;
};

const rotateMaskCCW = (mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dest[(w - 1 - x) * h + y] = mask[y * w + x];
    }
  }
  return dest;
};

const flipMaskH = (mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dest[y * w + (w - 1 - x)] = mask[y * w + x];
    }
  }
  return dest;
};

const flipMaskV = (mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const dest = new Uint8ClampedArray(mask.length);
  for (let y = 0; y < h; y++) {
    const srcRowIdx = y * w;
    const destRowIdx = (h - 1 - y) * w;
    dest.set(mask.subarray(srcRowIdx, srcRowIdx + w), destRowIdx);
  }
  return dest;
};

const cropPixels = (
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number
): Uint8ClampedArray => {
  const next = new Uint8ClampedArray(cropW * cropH * 4);
  for (let dy = 0; dy < cropH; dy++) {
    const sy = cropY + dy;
    const sx = cropX;
    const sourceIdx = (sy * w + sx) * 4;
    const destIdx = dy * cropW * 4;
    next.set(pixels.subarray(sourceIdx, sourceIdx + cropW * 4), destIdx);
  }
  return next;
};

const cropAndScalePixels = (
  pixels: Uint8ClampedArray,
  oldW: number,
  oldH: number,
  cropRect: { x: number; y: number; w: number; h: number },
  newW: number,
  newH: number
): Uint8ClampedArray => {
  const canvas1 = document.createElement('canvas');
  canvas1.width = oldW;
  canvas1.height = oldH;
  const ctx1 = canvas1.getContext('2d');
  if (!ctx1) return new Uint8ClampedArray(newW * newH * 4);
  const imgData1 = ctx1.createImageData(oldW, oldH);
  imgData1.data.set(pixels);
  ctx1.putImageData(imgData1, 0, 0);
  const canvas2 = document.createElement('canvas');
  canvas2.width = newW;
  canvas2.height = newH;
  const ctx2 = canvas2.getContext('2d');
  if (!ctx2) return new Uint8ClampedArray(newW * newH * 4);
  ctx2.drawImage(
    canvas1,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    0, 0, newW, newH
  );
  return ctx2.getImageData(0, 0, newW, newH).data;
};

const cropAndScaleMask = (
  maskBuffer: Uint8ClampedArray,
  oldW: number,
  oldH: number,
  cropRect: { x: number; y: number; w: number; h: number },
  newW: number,
  newH: number
): Uint8ClampedArray => {
  const canvas1 = document.createElement('canvas');
  canvas1.width = oldW;
  canvas1.height = oldH;
  const ctx1 = canvas1.getContext('2d');
  if (!ctx1) return new Uint8ClampedArray(newW * newH);
  const imgData1 = ctx1.createImageData(oldW, oldH);
  for (let i = 0; i < maskBuffer.length; i++) {
    const val = maskBuffer[i];
    const idx = i * 4;
    imgData1.data[idx] = val;
    imgData1.data[idx + 1] = val;
    imgData1.data[idx + 2] = val;
    imgData1.data[idx + 3] = 255;
  }
  ctx1.putImageData(imgData1, 0, 0);
  const canvas2 = document.createElement('canvas');
  canvas2.width = newW;
  canvas2.height = newH;
  const ctx2 = canvas2.getContext('2d');
  if (!ctx2) return new Uint8ClampedArray(newW * newH);
  ctx2.drawImage(
    canvas1,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    0, 0, newW, newH
  );
  const imgData2 = ctx2.getImageData(0, 0, newW, newH);
  const destBuffer = new Uint8ClampedArray(newW * newH);
  for (let i = 0; i < destBuffer.length; i++) {
    destBuffer[i] = imgData2.data[i * 4];
  }
  return destBuffer;
};

interface CropRegion {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  base64: string;
  brushX: number;
  brushY: number;
  brushW: number;
  brushH: number;
}

const cropAndOverlayMask = (
  orig: Uint8ClampedArray,
  w: number,
  h: number,
  mask: Uint8ClampedArray,
  withOverlay: boolean = false
): CropRegion | null => {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let hasPixels = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  if (!hasPixels) return null;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  const padX = Math.max(64, Math.round(boxW * 0.5));
  const padY = Math.max(64, Math.round(boxH * 0.5));

  const cropX = Math.max(0, minX - padX);
  const cropY = Math.max(0, minY - padY);
  const cropEndX = Math.min(w - 1, maxX + padX);
  const cropEndY = Math.min(h - 1, maxY + padY);

  const cropW = cropEndX - cropX + 1;
  const cropH = cropEndY - cropY + 1;

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(cropW, cropH);

  for (let cy = 0; cy < cropH; cy++) {
    const sy = cropY + cy;
    for (let cx = 0; cx < cropW; cx++) {
      const sx = cropX + cx;
      const srcIdx = (sy * w + sx) * 4;
      const destIdx = (cy * cropW + cx) * 4;

      if (withOverlay && mask[sy * w + sx] > 128) {
        imgData.data[destIdx] = 255;
        imgData.data[destIdx + 1] = 0;
        imgData.data[destIdx + 2] = 0;
        imgData.data[destIdx + 3] = 255;
      } else {
        imgData.data[destIdx] = orig[srcIdx];
        imgData.data[destIdx + 1] = orig[srcIdx + 1];
        imgData.data[destIdx + 2] = orig[srcIdx + 2];
        imgData.data[destIdx + 3] = orig[srcIdx + 3];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const base64 = canvas.toDataURL('image/png');

  return {
    cropX,
    cropY,
    cropW,
    cropH,
    base64,
    brushX: minX - cropX,
    brushY: minY - cropY,
    brushW: boxW,
    brushH: boxH
  };
};

const loadImageDataFromDataUrl = (dataUrl: string, targetW: number, targetH: number): Promise<Uint8ClampedArray> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas 2D context'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      resolve(imgData.data);
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
};

export const App: React.FC = () => {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageMeta, setImageMeta] = useState({ name: '', size: '', dim: '' });
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gridren-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('gridren-theme', theme);
  }, [theme]);

  const [isCvReady, setIsCvReady] = useState(false);

  useEffect(() => {
    if (document.getElementById('opencv-script')) {
      if ((window as any).cv && (window as any).cv.Mat) {
        setIsCvReady(true);
      }
      return;
    }
    (window as any).Module = {
      onRuntimeInitialized: () => {
        setIsCvReady(true);
      }
    };
    (window as any).cv = (window as any).cv || {};
    (window as any).cv.onRuntimeInitialized = (window as any).Module.onRuntimeInitialized;
    const script = document.createElement('script');
    script.id = 'opencv-script';
    script.src = 'https://docs.opencv.org/4.5.4/opencv.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const [globalAdjustments, setGlobalAdjustments] = useState<AdjustmentState>(initialAdjustments());
  const [globalCurves, setGlobalCurves] = useState<CurvesState>(initialCurves());
  const [globalPreset, setGlobalPreset] = useState<PresetType>('none');

  const pendingAdjRef = useRef<AdjustmentState>(initialAdjustments());
  const canvasRef = useRef<CanvasWorkspaceHandle>(null);

  const [masks, setMasks] = useState<MaskData[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);

  const [brushSize, setBrushSize] = useState(30);
  const [brushFeather, setBrushFeather] = useState(0.5);
  const [brushOpacity, setBrushOpacity] = useState(0.8);
  const [brushMode, setBrushMode] = useState<'add' | 'erase'>('add');
  const [showOverlay, setShowOverlay] = useState(false);


  const [uiCollapsed, setUiCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('presets');
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isComparing, setIsComparing] = useState(false);

  const [cropMode, setCropMode] = useState(false);
  const [cropAspectRatio, setCropAspectRatio] = useState<string>('free');
  const [customRatioW, setCustomRatioW] = useState<number>(16);
  const [customRatioH, setCustomRatioH] = useState<number>(9);

  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyIndexRef = useRef(historyIndex);
  const historyStackRef = useRef(historyStack);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    historyStackRef.current = historyStack;
  }, [historyStack]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState(0);
  const [previewH, setPreviewH] = useState(0);

  const [origPixels, setOrigPixels] = useState<Uint8ClampedArray | null>(null);
  const [eraserBuffer, setEraserBuffer] = useState<Uint8ClampedArray | null>(null);
  const [hasEraserPixels, setHasEraserPixels] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eraserMode, setEraserMode] = useState<'local' | 'ai'>('local');
  const [aiPrompt, setAiPrompt] = useState('Erase the red highlighted area and reconstruct the background seamlessly.');

  const [splitRatio, setSplitRatio] = useState<number | null>(null);

  const activeMask = masks.find(m => m.id === activeMaskId);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const pushHistory = (
    nextAdj = globalAdjustments,
    nextCrv = globalCurves,
    nextPre = globalPreset,
    nextMsk = masks,
    nextAct = activeMaskId,
    nextPixels = origPixels,
    nextW = previewW,
    nextH = previewH
  ) => {
    const newStack = historyStackRef.current.slice(0, historyIndexRef.current + 1);
    const state: HistoryState = {
      globalAdjustments: { ...nextAdj },
      globalCurves: JSON.parse(JSON.stringify(nextCrv)),
      globalPreset: nextPre,
      activeMaskId: nextAct,
      masks: nextMsk.map(m => ({
        ...m,
        buffer: new Uint8ClampedArray(m.buffer),
        adjustments: { ...m.adjustments },
        curves: JSON.parse(JSON.stringify(m.curves)),
      })),
      origPixels: nextPixels ? new Uint8ClampedArray(nextPixels) : new Uint8ClampedArray(0),
      previewW: nextW,
      previewH: nextH,
    };
    const updatedStack = [...newStack, state];
    setHistoryStack(updatedStack);
    setHistoryIndex(newStack.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      restoreHistoryState(historyStack[idx]);
      showToast('Undo performed');
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      restoreHistoryState(historyStack[idx]);
      showToast('Redo performed');
    }
  };

  const restoreHistoryState = (state: HistoryState) => {
    const adj = state.globalAdjustments;
    setGlobalAdjustments(adj);
    pendingAdjRef.current = { ...adj };
    setGlobalCurves(state.globalCurves);
    setGlobalPreset(state.globalPreset);
    setActiveMaskId(state.activeMaskId);
    setMasks(state.masks.map(m => ({
      ...m,
      buffer: new Uint8ClampedArray(m.buffer),
      adjustments: { ...m.adjustments },
      curves: JSON.parse(JSON.stringify(m.curves)),
    })));
    if (state.origPixels && state.origPixels.length > 0) {
      const copy = new Uint8ClampedArray(state.origPixels);
      setOrigPixels(copy);
      canvasRef.current?.setOrigPixels(copy, state.previewW, state.previewH);
    }
    setPreviewW(state.previewW);
    setPreviewH(state.previewH);
  };

  const handleImageLoad = (img: HTMLImageElement, w: number, h: number, pixels?: Uint8ClampedArray) => {
    const isNewImage = !imageElement;
    setImageElement(img);
    setPreviewW(w);
    setPreviewH(h);
    setEraserBuffer(new Uint8ClampedArray(w * h));
    setHasEraserPixels(false);
    if (pixels) {
      const copy = new Uint8ClampedArray(pixels);
      setOrigPixels(copy);
      setHistoryStack(prev => {
        if (prev.length === 1 && prev[0].origPixels.length === 0) {
          return [{
            ...prev[0],
            origPixels: copy,
            previewW: w,
            previewH: h
          }];
        }
        return prev;
      });
    }

    if (isNewImage) {
      setImageMeta({
        name: 'IMAGE_WORKSPACE',
        size: `${Math.round((img.src.length * 3) / 4 / 1024)} KB`,
        dim: `${img.naturalWidth} x ${img.naturalHeight}`,
      });

      setMasks([]);
      setActiveMaskId(null);
      setGlobalAdjustments(initialAdjustments());
      setGlobalCurves(initialCurves());
      setGlobalPreset('none');

      const initialState: HistoryState = {
        globalAdjustments: initialAdjustments(),
        globalCurves: initialCurves(),
        globalPreset: 'none',
        masks: [],
        activeMaskId: null,
        origPixels: pixels ? new Uint8ClampedArray(pixels) : new Uint8ClampedArray(0),
        previewW: w,
        previewH: h,
      };
      setHistoryStack([initialState]);
      setHistoryIndex(0);
      pendingAdjRef.current = initialAdjustments();
      setZoom(100);
      setPan({ x: 0, y: 0 });
      showToast('Workspace initialized');
    } else {
      setImageMeta(prev => ({
        ...prev,
        dim: `${img.naturalWidth} x ${img.naturalHeight}`,
        size: `${Math.round((img.src.length * 3) / 4 / 1024)} KB`
      }));
    }
  };


  const handleClearEraserMask = () => {
    if (eraserBuffer) {
      eraserBuffer.fill(0);
      setEraserBuffer(new Uint8ClampedArray(eraserBuffer));
      setHasEraserPixels(false);
      showToast('Eraser selection cleared');
    }
  };
  const handleApplyErase = async () => {
    const orig = canvasRef.current?.getOrigPixels();
    if (!orig || !eraserBuffer || !previewW || !previewH) return;
    if (!hasEraserPixels) {
      showToast('Please paint on the image first');
      return;
    }
    setIsProcessing(true);
    try {
      let nextPixels: Uint8ClampedArray;
      if (eraserMode === 'ai') {
        const cropRegion = cropAndOverlayMask(orig, previewW, previewH, eraserBuffer, false);
        if (!cropRegion) {
          throw new Error('No masked pixels found.');
        }
        const res = await fetch('/api/v1/inpaint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: cropRegion.base64,
            prompt: aiPrompt,
            region: {
              x: cropRegion.brushX,
              y: cropRegion.brushY,
              w: cropRegion.brushW,
              h: cropRegion.brushH
            }
          }),
        });
        if (!res.ok) {
          const errData = await res.json() as any;
          throw new Error(errData.error || `HTTP ${res.status} from backend`);
        }
        const data = await res.json() as any;
        const resultPixels = await loadImageDataFromDataUrl(data.image, cropRegion.cropW, cropRegion.cropH);
        nextPixels = new Uint8ClampedArray(orig);
        for (let cy = 0; cy < cropRegion.cropH; cy++) {
          const sy = cropRegion.cropY + cy;
          const srcRowStart = cy * cropRegion.cropW * 4;
          const destRowStart = (sy * previewW + cropRegion.cropX) * 4;
          nextPixels.set(resultPixels.subarray(srcRowStart, srcRowStart + cropRegion.cropW * 4), destRowStart);
        }
      } else {
        const holeCount = countMaskPixels(eraserBuffer);
        const totalPixels = previewW * previewH;
        const holeRatio = holeCount / totalPixels;

        if (holeRatio < 0.02) {
          if (!isCvReady) {
            showToast('OpenCV.js is loading, please wait...');
            setIsProcessing(false);
            return;
          }
          nextPixels = applyInpaint(orig, previewW, previewH, eraserBuffer);
        } else {
          try {
            nextPixels = await applyPatchMatch(orig, previewW, previewH, eraserBuffer);
          } catch (pmErr) {
            console.warn('PatchMatch failed, falling back to OpenCV:', pmErr);
            if (!isCvReady) {
              showToast('OpenCV.js is loading, please wait...');
              setIsProcessing(false);
              return;
            }
            nextPixels = applyInpaint(orig, previewW, previewH, eraserBuffer);
          }
        }
      }

      canvasRef.current?.setOrigPixels(nextPixels, previewW, previewH);
      setOrigPixels(nextPixels);
      eraserBuffer.fill(0);
      setEraserBuffer(new Uint8ClampedArray(eraserBuffer));
      pushHistory(globalAdjustments, globalCurves, globalPreset, masks, activeMaskId, nextPixels, previewW, previewH);
      setHasEraserPixels(false);
      showToast('Object erased successfully');
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Failed to erase object');
    } finally {
      setIsProcessing(false);
    }
  };
  const addMask = (type: 'brush' | 'radial' | 'linear') => {
    if (!previewW || !previewH) return;
    const buffer = new Uint8ClampedArray(previewW * previewH);
    const newMask: MaskData = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${type.toUpperCase()} MASK ${masks.length + 1}`,
      type,
      buffer,
      visible: true,
      adjustments: initialAdjustments(),
      curves: initialCurves(),
    };

    const nextMasks = [...masks, newMask];
    setMasks(nextMasks);
    setActiveMaskId(newMask.id);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, newMask.id);
    showToast(`Created ${type} mask`);
  };

  const deleteMask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMasks = masks.filter(m => m.id !== id);
    let nextActive = activeMaskId;
    if (activeMaskId === id) {
      nextActive = null;
    }
    setMasks(nextMasks);
    setActiveMaskId(nextActive);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, nextActive);
    showToast('Mask removed');
  };

  const toggleMaskVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMasks = masks.map(m => {
      if (m.id === id) {
        return { ...m, visible: !m.visible };
      }
      return m;
    });
    setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId);
  };

  const handleMaskUpdate = (id: string, buffer: Uint8ClampedArray) => {
    setMasks(prev =>
      prev.map(m => {
        if (m.id === id) {
          return { ...m, buffer };
        }
        return m;
      })
    );
  };

  const handleAdjustmentChange = (key: keyof AdjustmentState, val: any) => {
    if (activeMask) {
      const nextMasks = masks.map(m => {
        if (m.id === activeMaskId) {
          return { ...m, adjustments: { ...m.adjustments, [key]: val } };
        }
        return m;
      });
      setMasks(nextMasks);
    } else {
      const next = { ...pendingAdjRef.current, [key]: val };
      pendingAdjRef.current = next;
      canvasRef.current?.liveRedraw(next, globalCurves, globalPreset);
    }
  };

  const commitAdjustmentHistory = () => {
    if (!activeMask) {
      setGlobalAdjustments(pendingAdjRef.current);
    }
    pushHistory(pendingAdjRef.current);
  };

  const handleCurveChange = (channel: keyof CurvesState, points: CurvePoint[]) => {
    if (activeMask) {
      const nextMasks = masks.map(m => {
        if (m.id === activeMaskId) {
          return {
            ...m,
            curves: { ...m.curves, [channel]: points },
          };
        }
        return m;
      });
      setMasks(nextMasks);
    } else {
      setGlobalCurves(prev => ({ ...prev, [channel]: points }));
    }
  };

  const selectPreset = (type: PresetType) => {
    setGlobalPreset(type);
    pushHistory(globalAdjustments, globalCurves, type, masks, activeMaskId);
    showToast(`Preset: ${type.toUpperCase()}`);
  };

  const exportHighRes = () => {
    if (!imageElement) return;

    showToast('Exporting high resolution...');

    setTimeout(() => {
      const w = imageElement.naturalWidth;
      const h = imageElement.naturalHeight;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = w;
      exportCanvas.height = h;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) return;

      const tempPrevCanvas = document.createElement('canvas');
      tempPrevCanvas.width = previewW;
      tempPrevCanvas.height = previewH;
      const tempPrevCtx = tempPrevCanvas.getContext('2d');
      if (tempPrevCtx && origPixels) {
        const tempImgData = tempPrevCtx.createImageData(previewW, previewH);
        tempImgData.data.set(origPixels);
        tempPrevCtx.putImageData(tempImgData, 0, 0);
        exportCtx.drawImage(tempPrevCanvas, 0, 0, w, h);
      } else {
        exportCtx.drawImage(imageElement, 0, 0, w, h);
      }

      const imgData = exportCtx.getImageData(0, 0, w, h);
      let pixels = imgData.data;

      masks.forEach(m => {
        if (m.visible) {
          const tempSrcCanvas = document.createElement('canvas');
          tempSrcCanvas.width = previewW;
          tempSrcCanvas.height = previewH;
          const tempSrcCtx = tempSrcCanvas.getContext('2d');
          if (!tempSrcCtx) return;

          const maskImgData = tempSrcCtx.createImageData(previewW, previewH);
          for (let i = 0; i < m.buffer.length; i++) {
            const val = m.buffer[i];
            const idx = i * 4;
            maskImgData.data[idx] = val;
            maskImgData.data[idx + 1] = val;
            maskImgData.data[idx + 2] = val;
            maskImgData.data[idx + 3] = 255;
          }
          tempSrcCtx.putImageData(maskImgData, 0, 0);

          const tempDstCanvas = document.createElement('canvas');
          tempDstCanvas.width = w;
          tempDstCanvas.height = h;
          const tempDstCtx = tempDstCanvas.getContext('2d');
          if (!tempDstCtx) return;

          tempDstCtx.drawImage(tempSrcCanvas, 0, 0, w, h);
          const scaledMaskData = tempDstCtx.getImageData(0, 0, w, h);
          const scaledBuffer = new Uint8ClampedArray(w * h);
          for (let i = 0; i < w * h; i++) {
            scaledBuffer[i] = scaledMaskData.data[i * 4];
          }

          pixels = processPixels(pixels, w, h, m.adjustments, m.curves, 'none', scaledBuffer);
        }
      });

      pixels = processPixels(pixels, w, h, globalAdjustments, globalCurves, globalPreset, null);

      imgData.data.set(pixels);
      exportCtx.putImageData(imgData, 0, 0);

      const link = document.createElement('a');
      link.download = `gridren_${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();

      showToast('Export complete');
    }, 100);
  };

  const handleBackToStart = () => {
    setShowConfirmBack(true);
  };

  const executeBackToStart = () => {
    setShowConfirmBack(false);
    setImageElement(null);
    setImageMeta({ name: '', size: '', dim: '' });
    setGlobalAdjustments(initialAdjustments());
    setGlobalCurves(initialCurves());
    setGlobalPreset('none');
    setMasks([]);
    setActiveMaskId(null);
    setHistoryStack([]);
    setHistoryIndex(-1);
  };

  const rotateCW = () => {
    const orig = canvasRef.current?.getOrigPixels();
    if (!orig || !previewW || !previewH || !imageElement) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageElement.naturalHeight;
    tempCanvas.height = imageElement.naturalWidth;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate(Math.PI / 2);
      tempCtx.drawImage(imageElement, -imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);
      const rotatedDataUrl = tempCanvas.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        setImageElement(newImg);
      };
      newImg.src = rotatedDataUrl;
    }
    const nextPixels = rotatePixelsCW(orig, previewW, previewH);
    const nextMasks = masks.map(m => ({ ...m, buffer: rotateMaskCW(m.buffer, previewW, previewH) }));
    canvasRef.current?.setOrigPixels(nextPixels, previewH, previewW);
    setPreviewW(previewH); setPreviewH(previewW); setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId, nextPixels, previewH, previewW);
    showToast('Rotated Clockwise');
  };

  const rotateCCW = () => {
    const orig = canvasRef.current?.getOrigPixels();
    if (!orig || !previewW || !previewH || !imageElement) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageElement.naturalHeight;
    tempCanvas.height = imageElement.naturalWidth;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate(-Math.PI / 2);
      tempCtx.drawImage(imageElement, -imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);
      const rotatedDataUrl = tempCanvas.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        setImageElement(newImg);
      };
      newImg.src = rotatedDataUrl;
    }
    const nextPixels = rotatePixelsCCW(orig, previewW, previewH);
    const nextMasks = masks.map(m => ({ ...m, buffer: rotateMaskCCW(m.buffer, previewW, previewH) }));
    canvasRef.current?.setOrigPixels(nextPixels, previewH, previewW);
    setPreviewW(previewH); setPreviewH(previewW); setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId, nextPixels, previewH, previewW);
    showToast('Rotated Counter-Clockwise');
  };

  const flipH = () => {
    const orig = canvasRef.current?.getOrigPixels();
    if (!orig || !previewW || !previewH || !imageElement) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageElement.naturalWidth;
    tempCanvas.height = imageElement.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.translate(tempCanvas.width, 0);
      tempCtx.scale(-1, 1);
      tempCtx.drawImage(imageElement, 0, 0);
      const flippedDataUrl = tempCanvas.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        setImageElement(newImg);
      };
      newImg.src = flippedDataUrl;
    }
    const nextPixels = flipPixelsH(orig, previewW, previewH);
    const nextMasks = masks.map(m => ({ ...m, buffer: flipMaskH(m.buffer, previewW, previewH) }));
    canvasRef.current?.setOrigPixels(nextPixels, previewW, previewH);
    setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId, nextPixels, previewW, previewH);
    showToast('Flipped Horizontally');
  };

  const flipV = () => {
    const orig = canvasRef.current?.getOrigPixels();
    if (!orig || !previewW || !previewH || !imageElement) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageElement.naturalWidth;
    tempCanvas.height = imageElement.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.translate(0, tempCanvas.height);
      tempCtx.scale(1, -1);
      tempCtx.drawImage(imageElement, 0, 0);
      const flippedDataUrl = tempCanvas.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        setImageElement(newImg);
      };
      newImg.src = flippedDataUrl;
    }
    const nextPixels = flipPixelsV(orig, previewW, previewH);
    const nextMasks = masks.map(m => ({ ...m, buffer: flipMaskV(m.buffer, previewW, previewH) }));
    canvasRef.current?.setOrigPixels(nextPixels, previewW, previewH);
    setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId, nextPixels, previewW, previewH);
    showToast('Flipped Vertically');
  };

  const applyCrop = () => {
    const cropRect = canvasRef.current?.getCurrentCropRect();
    const orig = canvasRef.current?.getOrigPixels();
    if (!cropRect || !orig || !previewW || !previewH || !imageElement) return;
    const scaleX = imageElement.naturalWidth / previewW;
    const scaleY = imageElement.naturalHeight / previewH;
    const naturalX = Math.round(cropRect.x * scaleX);
    const naturalY = Math.round(cropRect.y * scaleY);
    const naturalW = Math.round(cropRect.w * scaleX);
    const naturalH = Math.round(cropRect.h * scaleY);
    const maxDim = 900;
    let newPreviewW = naturalW;
    let newPreviewH = naturalH;
    if (newPreviewW > maxDim || newPreviewH > maxDim) {
      if (newPreviewW > newPreviewH) {
        newPreviewH = Math.round((newPreviewH * maxDim) / newPreviewW);
        newPreviewW = maxDim;
      } else {
        newPreviewW = Math.round((newPreviewW * maxDim) / newPreviewH);
        newPreviewH = maxDim;
      }
    }
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = naturalW;
    cropCanvas.height = naturalH;
    const cropCtx = cropCanvas.getContext('2d');
    if (cropCtx) {
      cropCtx.drawImage(
        imageElement,
        naturalX, naturalY, naturalW, naturalH,
        0, 0, naturalW, naturalH
      );
      const croppedDataUrl = cropCanvas.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        setImageElement(newImg);
      };
      newImg.src = croppedDataUrl;
    }
    const nextPixels = cropAndScalePixels(orig, previewW, previewH, cropRect, newPreviewW, newPreviewH);
    const nextMasks = masks.map(mask => ({
      ...mask,
      buffer: cropAndScaleMask(mask.buffer, previewW, previewH, cropRect, newPreviewW, newPreviewH)
    }));
    canvasRef.current?.setOrigPixels(nextPixels, newPreviewW, newPreviewH);
    setPreviewW(newPreviewW);
    setPreviewH(newPreviewH);
    setMasks(nextMasks);
    pushHistory(globalAdjustments, globalCurves, globalPreset, nextMasks, activeMaskId, nextPixels, newPreviewW, newPreviewH);
    setCropMode(false);
    showToast('Image cropped successfully');
  };

  const cancelCrop = () => {
    setCropMode(false);
    showToast('Crop canceled');
  };


  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      setUiCollapsed(!uiCollapsed);
    } else {
      setActiveTab(tab);
      setUiCollapsed(false);
    }
  };

  return (
    <div className={`gridren-app theme-${theme}`}>
      <AppHeader
        theme={theme}
        setTheme={setTheme}
        imageElement={imageElement}
        imageMeta={imageMeta}
        historyIndex={historyIndex}
        historyStackLength={historyStack.length}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        exportHighRes={exportHighRes}
        uiCollapsed={uiCollapsed}
        setUiCollapsed={setUiCollapsed}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        onResetPan={() => setPan({ x: 0, y: 0 })}
        onBack={handleBackToStart}
        isComparing={isComparing}
        setIsComparing={setIsComparing}
      />

      <main className={`main-layout ${!imageElement ? 'no-image' : ''} ${uiCollapsed ? 'collapsed-ui' : ''}`}>
        <div className="workspace-area">
          <CanvasWorkspace
            ref={canvasRef}
            imageElement={imageElement}
            adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
            curves={activeMask ? activeMask.curves : globalCurves}
            preset={globalPreset}
            masks={masks}
            activeMaskId={activeMaskId}
            brushSize={brushSize}
            brushFeather={brushFeather}
            brushOpacity={brushOpacity}
            brushMode={brushMode}
            onMaskUpdate={handleMaskUpdate}
            onImageLoad={handleImageLoad}
            showOverlay={showOverlay}
            uiCollapsed={uiCollapsed}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
            splitRatio={splitRatio}
            setSplitRatio={setSplitRatio}
            cropMode={cropMode}
            cropAspectRatio={cropAspectRatio}
            customRatioW={customRatioW}
            customRatioH={customRatioH}
            isComparing={isComparing}
            isEraserMode={activeTab === 'eraser'}
            eraserBuffer={eraserBuffer}
            onEraserMaskUpdate={setHasEraserPixels}
          />

          {imageElement && (
            <div className="workspace-bottom-panel">
              <div className="unified-bottom-bar">
                <SidebarTabs
                  activeTab={activeTab}
                  setActiveTab={handleTabClick}
                  uiCollapsed={uiCollapsed}
                />
              </div>
            </div>
          )}
        </div>

        {imageElement && (
          <aside className="sidebar-panel">

            <div className="sidebar-content">
              {activeTab === 'presets' && (
                <PresetsModule
                  globalPreset={globalPreset}
                  selectPreset={selectPreset}
                />
              )}

              {activeTab === 'basic' && (
                <div className="control-module active-module">
                  <div className="module-title-clean">
                    {activeMask ? `Basic Sliders (${activeMask.name})` : 'Basic Sliders (Global)'}
                  </div>
                  <div className="module-content" onMouseUp={commitAdjustmentHistory}>
                    <AdjustmentSliders
                      adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                      onChange={handleAdjustmentChange}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'hsl' && (
                <>
                  <ColorMixerModule
                    adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                    onChange={handleAdjustmentChange}
                    onMouseUp={commitAdjustmentHistory}
                  />
                  <div style={{ marginTop: '20px' }}>
                    <ColorGradingModule
                      adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                      onChange={handleAdjustmentChange}
                      onMouseUp={commitAdjustmentHistory}
                    />
                  </div>
                </>
              )}

              {activeTab === 'detail' && (
                <DetailModule
                  adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                  onChange={handleAdjustmentChange}
                  onMouseUp={commitAdjustmentHistory}
                />
              )}

              {activeTab === 'effects' && (
                <CreativeEffectsModule
                  adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                  onChange={handleAdjustmentChange}
                  onMouseUp={commitAdjustmentHistory}
                />
              )}


              {activeTab === 'lens' && (
                <LensModule
                  adjustments={activeMask ? activeMask.adjustments : globalAdjustments}
                  onChange={handleAdjustmentChange}
                  onMouseUp={commitAdjustmentHistory}
                />
              )}

              {activeTab === 'curves' && (
                <CurvesModule
                  activeMask={activeMask}
                  globalCurves={globalCurves}
                  theme={theme}
                  handleCurveChange={handleCurveChange}
                  commitAdjustmentHistory={commitAdjustmentHistory}
                />
              )}

              {activeTab === 'masks' && (
                <MasksModule
                  masks={masks}
                  activeMaskId={activeMaskId}
                  setActiveMaskId={setActiveMaskId}
                  addMask={addMask}
                  deleteMask={deleteMask}
                  toggleMaskVisibility={toggleMaskVisibility}
                  pushHistory={pushHistory}
                  globalAdjustments={globalAdjustments}
                  globalCurves={globalCurves}
                  globalPreset={globalPreset}
                  activeMask={activeMask}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  brushFeather={brushFeather}
                  setBrushFeather={setBrushFeather}
                  brushOpacity={brushOpacity}
                  setBrushOpacity={setBrushOpacity}
                  brushMode={brushMode}
                  setBrushMode={setBrushMode}
                  showOverlay={showOverlay}
                  setShowOverlay={setShowOverlay}
                />
              )}
              {activeTab === 'eraser' && (
                <EraserModule
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  brushFeather={brushFeather}
                  setBrushFeather={setBrushFeather}
                  brushOpacity={brushOpacity}
                  setBrushOpacity={setBrushOpacity}
                  brushMode={brushMode}
                  setBrushMode={setBrushMode}
                  onClearMask={handleClearEraserMask}
                  onApplyErase={handleApplyErase}
                  hasMaskPixels={hasEraserPixels}
                  isCvReady={isCvReady}
                  eraserMode={eraserMode}
                  setEraserMode={setEraserMode}
                  aiPrompt={aiPrompt}
                  setAiPrompt={setAiPrompt}
                />
              )}
              {activeTab === 'geometry' && (
                <TransformModule
                  onRotateCW={rotateCW}
                  onRotateCCW={rotateCCW}
                  onFlipH={flipH}
                  onFlipV={flipV}
                  splitRatio={splitRatio}
                  onToggleSplit={() => setSplitRatio(prev => prev === null ? 0.5 : null)}
                  cropMode={cropMode}
                  setCropMode={setCropMode}
                  cropAspectRatio={cropAspectRatio}
                  setCropAspectRatio={setCropAspectRatio}
                  customRatioW={customRatioW}
                  setCustomRatioW={setCustomRatioW}
                  customRatioH={customRatioH}
                  setCustomRatioH={setCustomRatioH}
                  onApplyCrop={applyCrop}
                  onCancelCrop={cancelCrop}
                  onMaximizeCrop={() => canvasRef.current?.maximizeCropRect()}
                />
              )}
            </div>
          </aside>
        )}
      </main>

      {toastMessage && <div className="toast">{toastMessage}</div>}

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-box">
            <div className="processing-spinner" />
            <span className="processing-text">Removing Object...</span>
          </div>
        </div>
      )}

      {showConfirmBack && (
        <div className="confirm-modal-overlay" onClick={() => setShowConfirmBack(false)}>
          <div className="confirm-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Confirm Navigation</h3>
            <p className="confirm-modal-text">Are you sure you want to leave? Your unsaved changes will be lost.</p>
            <div className="confirm-modal-actions">
              <button className="btn" onClick={() => setShowConfirmBack(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={executeBackToStart}>Leave Workspace</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
