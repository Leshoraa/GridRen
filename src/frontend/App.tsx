import React, { useState, useEffect } from 'react';
import { CanvasWorkspace, MaskData } from './components/CanvasWorkspace';
import { AppHeader } from './components/AppHeader';
import { PresetsModule } from './components/PresetsModule';
import { AdjustmentsModule } from './components/AdjustmentsModule';
import { CurvesModule } from './components/CurvesModule';
import { MasksModule } from './components/MasksModule';
import { SidebarTabs } from './components/SidebarTabs';
import { AdjustmentState, CurvePoint, CurvesState, PresetType, processPixels } from './utils/imageProcess';

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
}

export const App: React.FC = () => {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageMeta, setImageMeta] = useState({ name: '', size: '', dim: '' });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gridren-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('gridren-theme', theme);
  }, [theme]);

  const [globalAdjustments, setGlobalAdjustments] = useState<AdjustmentState>(initialAdjustments());
  const [globalCurves, setGlobalCurves] = useState<CurvesState>(initialCurves());
  const [globalPreset, setGlobalPreset] = useState<PresetType>('none');

  const [masks, setMasks] = useState<MaskData[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);

  const [brushSize, setBrushSize] = useState(30);
  const [brushFeather, setBrushFeather] = useState(0.5);
  const [brushOpacity, setBrushOpacity] = useState(0.8);
  const [brushMode, setBrushMode] = useState<'add' | 'erase'>('add');
  const [showOverlay, setShowOverlay] = useState(false);

  const [uiCollapsed, setUiCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'adjustments' | 'curves' | 'masks'>('presets');
  const [zoom, setZoom] = useState(100);

  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewW, setPreviewW] = useState(0);
  const [previewH, setPreviewH] = useState(0);

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
    nextAct = activeMaskId
  ) => {
    const newStack = historyStack.slice(0, historyIndex + 1);
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
    };
    setHistoryStack([...newStack, state]);
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
    setGlobalAdjustments(state.globalAdjustments);
    setGlobalCurves(state.globalCurves);
    setGlobalPreset(state.globalPreset);
    setActiveMaskId(state.activeMaskId);
    setMasks(state.masks.map(m => ({
      ...m,
      buffer: new Uint8ClampedArray(m.buffer),
      adjustments: { ...m.adjustments },
      curves: JSON.parse(JSON.stringify(m.curves)),
    })));
  };

  const handleImageLoad = (img: HTMLImageElement, w: number, h: number) => {
    setImageElement(img);
    setPreviewW(w);
    setPreviewH(h);

    if (imageMeta.name === '') {
      setImageMeta({
        name: 'IMAGE_WORKSPACE',
        size: `${Math.round((img.src.length * 3) / 4 / 1024)} KB`,
        dim: `${img.naturalWidth} x ${img.naturalHeight}`,
      });
    }

    const initialMsk: MaskData[] = [];
    setMasks(initialMsk);
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
    };
    setHistoryStack([initialState]);
    setHistoryIndex(0);
    showToast('Workspace initialized');
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
          return {
            ...m,
            adjustments: { ...m.adjustments, [key]: val },
          };
        }
        return m;
      });
      setMasks(nextMasks);
    } else {
      setGlobalAdjustments(prev => ({ ...prev, [key]: val }));
    }
  };

  const commitAdjustmentHistory = () => {
    pushHistory();
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

      exportCtx.drawImage(imageElement, 0, 0, w, h);
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

  const handleTabClick = (tab: 'presets' | 'adjustments' | 'curves' | 'masks') => {
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
      />

      <main className={`main-layout ${!imageElement ? 'no-image' : ''} ${uiCollapsed ? 'collapsed-ui' : ''}`}>
        <div className="workspace-area">
          <CanvasWorkspace
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
          />

          {imageElement && (
            <SidebarTabs
              activeTab={activeTab}
              setActiveTab={handleTabClick}
              uiCollapsed={uiCollapsed}
            />
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

              {activeTab === 'adjustments' && (
                <AdjustmentsModule
                  activeMask={activeMask}
                  globalAdjustments={globalAdjustments}
                  handleAdjustmentChange={handleAdjustmentChange}
                  commitAdjustmentHistory={commitAdjustmentHistory}
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
            </div>
          </aside>
        )}
      </main>

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};
export default App;
