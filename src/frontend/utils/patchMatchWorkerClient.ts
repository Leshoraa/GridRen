import { runPatchMatchInWorker, PatchMatchParams } from './patchMatchWorker';

export async function applyPatchMatch(
  pixels: Uint8ClampedArray, w: number, h: number,
  mask: Uint8ClampedArray, params?: Partial<PatchMatchParams>
): Promise<Uint8ClampedArray> {
  const result = await runPatchMatchInWorker(pixels, mask, w, h, params);
  if (!result) throw new Error('PatchMatch failed or was cancelled');
  return result;
}

export type { PatchMatchParams };
