import { processPixels, AdjustmentState, CurvesState, PresetType } from '../utils/imageProcess';

interface WorkerMessage {
  id: number;
  src: Uint8ClampedArray;
  w: number;
  h: number;
  adjustments: AdjustmentState;
  curves: CurvesState;
  preset: PresetType;
  mask: Uint8ClampedArray | null;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, src, w, h, adjustments, curves, preset, mask } = e.data;
  const result = processPixels(src, w, h, adjustments, curves, preset, mask);
  self.postMessage({ id, result }, [result.buffer]);
};
