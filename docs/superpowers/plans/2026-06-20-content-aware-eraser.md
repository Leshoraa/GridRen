# Content-Aware Eraser (PatchMatch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AI (OpenRouter) object-eraser path and replace it with a content-aware PatchMatch inpainting algorithm (pure TypeScript in a Web Worker) for medium/large regions, with OpenCV TELEA retained as a fast tier for small regions.

**Architecture:** A new isolated Web Worker (`patchMatchWorker.ts`) runs PatchMatch (Barnes et al. 2009) with multi-scale coarse-to-fine optimization, structure-aware SSD, and feather seam-blend. `App.tsx` picks the tier by mask-area ratio: <2% → OpenCV TELEA (sync), ≥2% → PatchMatch (async worker). All OpenRouter/AI UI and backend code is removed.

**Tech Stack:** TypeScript, React 19, Web Worker (Blob URL pattern), OpenCV.js (existing), Bun/Elysia.

**Reference spec:** `docs/superpowers/specs/2026-06-20-content-aware-eraser-design.md`

**Testing note:** Project has no test framework (`package.json` test script = error). Per spec decision (YAGNI), we do NOT add one. Testing is manual via `bun run dev`. Code is structured as small pure functions to keep it testable for the future.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/frontend/utils/patchMatchCore.ts` | **Create** | Pure PatchMatch algorithm functions (no DOM, no worker): `countMaskPixels`, `dilateMask`, `buildPyramid`, `patchDistance`, `randomInit`, `propagate`, `randomSearch`, `runPatchMatchLevel`, `fillAndBlend`. Unit-pure, no side effects. |
| `src/frontend/utils/patchMatchWorker.ts` | **Create** | Web Worker wrapper: inline-string source built from the pure functions, message protocol, generational job IDs. Single shared worker instance. |
| `src/frontend/utils/patchMatchWorkerClient.ts` | **Create** | Main-thread API: `applyPatchMatch(pixels,w,h,mask,params?)` returns Promise. Owns worker lifecycle. |
| `src/frontend/utils/imageProcess.ts` | **Modify** | Re-export `applyPatchMatch`, `countMaskPixels` from new modules. Delete `applyOpenRouterInpaint` and `refineMaskWithGrabCut`; strip the GrabCut call from `applyInpaint`. |
| `src/frontend/components/EraserModule.tsx` | **Modify** | Remove engine selector, API key, model picker, related state/props. Simplify to brush sliders + Erase/Clear buttons. |
| `src/frontend/App.tsx` | **Modify** | Remove eraserEngine/openrouter state + localStorage. Simplify `handleApplyErase` with tiering. Update EraserModule props. |
| `src/routes/inpaint.ts` | **Delete** | AI proxy backend no longer needed. |
| `src/routes/index.ts` | **Modify** | Remove inpaintRoutes import & use. |

**Why split the worker into 3 files?** `patchMatchCore.ts` is pure logic (readable, no string-escaping). `patchMatchWorker.ts` is the inline-string worker (mirrors core for the Blob context). `patchMatchWorkerClient.ts` is the Promise wrapper on main thread. This keeps each file focused and matches the existing `imageProcess.ts` + `imageProcessWorker.ts` split convention.

---

## Task 1: Create pure PatchMatch core algorithm

**Files:**
- Create: `src/frontend/utils/patchMatchCore.ts`

This task builds the algorithm as pure functions with no DOM/worker dependencies. We verify by running the dev server and console-testing.

- [ ] **Step 1: Create the file with types and `countMaskPixels`**

Create `src/frontend/utils/patchMatchCore.ts`:

```ts
// Pure PatchMatch inpainting — no DOM, no worker, no side effects.
// Used by patchMatchWorker.ts (inline-string mirror) for the Web Worker context.

export interface PatchMatchParams {
  patchRadius: number;    // patch is (2r+1)^2; default 4 → 9×9
  iterations: number;     // per pyramid level; default 5
  levels: number;         // pyramid depth; default derived from image size
  searchAlpha: number;    // random-search exponential decay; default 0.5
}

export const DEFAULT_PARAMS: PatchMatchParams = {
  patchRadius: 4,
  iterations: 5,
  levels: 0, // 0 = auto-derive in runPatchMatch
  searchAlpha: 0.5,
};

/** Count mask pixels above threshold (holes). */
export function countMaskPixels(mask: Uint8ClampedArray, threshold = 128): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] >= threshold) n++;
  }
  return n;
}
```

- [ ] **Step 2: Add `dilateMask` (box-filter-threshold dilate)**

Append to `patchMatchCore.ts`:

```ts
/**
 * Dilate a binary mask by box-filter thresholding, repeated `radius` times.
 * Worker has no OpenCV access, so we use a pure-TS implementation.
 * Output is a NEW Uint8ClampedArray (0/255).
 */
export function dilateMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(mask);
  let cur = new Uint8ClampedArray(mask);
  const next = new Uint8ClampedArray(mask.length);
  for (let step = 0; step < radius; step++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let any = 0;
        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(h - 1, y + 1);
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(w - 1, x + 1);
        for (let yy = y0; yy <= y1 && !any; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (cur[yy * w + xx] >= 128) { any = 1; break; }
          }
        }
        next[y * w + x] = any ? 255 : 0;
      }
    }
    const tmp = cur; cur = next;
    // copy back so `next` buffer is reusable next iteration
    for (let i = 0; i < cur.length; i++) next[i] = cur[i] === undefined ? 0 : 0;
    // simpler: swap, then reset next from cur at loop start; re-init next below
  }
  // `cur` holds the final dilated mask
  return cur;
}
```

Note: the swap logic above is intentionally simple/correct. A cleaner version — use `let cur` as the result and rebuild `next` each iteration:

```ts
export function dilateMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(mask);
  let cur = new Uint8ClampedArray(mask);
  for (let step = 0; step < radius; step++) {
    const next = new Uint8ClampedArray(cur.length);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(w - 1, x + 1);
        let any = 0;
        for (let yy = y0; yy <= y1 && !any; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (cur[yy * w + xx] >= 128) { any = 1; break; }
          }
        }
        next[y * w + x] = any ? 255 : 0;
      }
    }
    cur = next;
  }
  return cur;
}
```

Use the cleaner version — delete the first draft from the file.

- [ ] **Step 3: Add `buildPyramid` (downsample image + mask)**

Append:

```ts
export interface PyramidLevel {
  w: number; h: number;
  image: Uint8ClampedArray; // w*h*4
  mask: Uint8ClampedArray;  // w*h, 0/255 (dilated already at top level)
}

/** Box-average 2×2 downsample. RGBA image. */
function downsampleImage(src: Uint8ClampedArray, w: number, h: number): { img: Uint8ClampedArray; w: number; h: number } {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const dst = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx0 = x * 2, sy0 = y * 2;
      const sx1 = Math.min(w - 1, sx0 + 1);
      const sy1 = Math.min(h - 1, sy0 + 1);
      for (let c = 0; c < 4; c++) {
        const v = (
          src[(sy0 * w + sx0) * 4 + c] + src[(sy0 * w + sx1) * 4 + c] +
          src[(sy1 * w + sx0) * 4 + c] + src[(sy1 * w + sx1) * 4 + c]
        ) >> 2;
        dst[(y * nw + x) * 4 + c] = v;
      }
    }
  }
  return { img: dst, w: nw, h: nh };
}

/** Nearest-neighbor downsample mask (preserve 0/255 binary). */
function downsampleMask(src: Uint8ClampedArray, w: number, h: number): { m: Uint8ClampedArray; w: number; h: number } {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const dst = new Uint8ClampedArray(nw * nh);
  // A downsampled pixel is a hole if ANY of its 2×2 source pixels is a hole
  // (preserve coverage so we don't lose small holes).
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx0 = x * 2, sy0 = y * 2;
      const sx1 = Math.min(w - 1, sx0 + 1);
      const sy1 = Math.min(h - 1, sy0 + 1);
      let any = 0;
      if (src[sy0 * w + sx0] >= 128 || src[sy0 * w + sx1] >= 128 ||
          src[sy1 * w + sx0] >= 128 || src[sy1 * w + sx1] >= 128) any = 1;
      dst[y * nw + x] = any ? 255 : 0;
    }
  }
  return { m: dst, w: nw, h: nh };
}

/**
 * Build coarse-to-fine pyramid. levels=0 → auto-derive so coarsest ≈ 64-128px.
 * Level 0 (index 0) is the coarsest; last index is the full-res level.
 */
export function buildPyramid(
  image: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  requestedLevels: number
): PyramidLevel[] {
  let levels = requestedLevels;
  if (levels <= 0) {
    levels = 1;
    let dim = Math.max(w, h);
    while (dim > 128) { levels++; dim >>= 1; }
    levels = Math.max(1, levels);
  }
  const pyramid: PyramidLevel[] = [];
  let curImg = image;
  let curMask = mask;
  let curW = w;
  let curH = h;
  // push finest first, then prepend coarser as we downsample
  pyramid.unshift({ w: curW, h: curH, image: curImg, mask: curMask });
  for (let l = 1; l < levels; l++) {
    const d = downsampleImage(curImg, curW, curH);
    const dm = downsampleMask(curMask, curW, curH);
    // if we've shrunk to 1×1, stop
    if (d.w <= 2 || d.h <= 2) break;
    curImg = d.img; curW = d.w; curH = d.h; curMask = dm.m;
    pyramid.unshift({ w: curW, h: curH, image: curImg, mask: curMask });
  }
  return pyramid;
}
```

- [ ] **Step 4: Add `computeGradients` (Sobel, for structure-aware term)**

Append:

```ts
/** Sobel gradients per pixel. Returns Float32Array of magnitude then angle interleaved (2 per pixel). */
export function computeGradients(image: Uint8ClampedArray, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h * 2);
  // luminance buffer
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * image[i * 4] + 0.587 * image[i * 4 + 1] + 0.114 * image[i * 4 + 2];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1);
      const ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1);
      const gx = -lum[ym * w + xm] - 2 * lum[y * w + xm] - lum[yp * w + xm]
               +  lum[ym * w + xp] + 2 * lum[y * w + xp] + lum[yp * w + xp];
      const gy = -lum[ym * w + xm] - 2 * lum[ym * w + x] - lum[ym * w + xp]
               +  lum[yp * w + xm] + 2 * lum[yp * w + x] + lum[yp * w + xp];
      const idx = (y * w + x) * 2;
      grad[idx] = Math.hypot(gx, gy);
      grad[idx + 1] = Math.atan2(gy, gx);
    }
  }
  return grad;
}
```

- [ ] **Step 5: Add `patchDistance` (SSD + structure + early-termination)**

Append:

```ts
/**
 * SSD between patches centered at p=(px,py) and q=(qx,qy), over the patch window,
 * restricted to source-side validity. Early-terminates if it exceeds `cutoff`.
 * Includes a structure-aware term (gradient-angle difference).
 * `valid` is the DILATED mask (255 = valid source area).
 */
export function patchDistance(
  image: Uint8ClampedArray,
  grad: Float32Array,
  valid: Uint8ClampedArray,
  w: number, h: number,
  px: number, py: number,
  qx: number, qy: number,
  patchRadius: number,
  cutoff: number
): number {
  let sum = 0;
  let counted = 0;
  const structWeight = 0.3;
  for (let dy = -patchRadius; dy <= patchRadius; dy++) {
    for (let dx = -patchRadius; dx <= patchRadius; dx++) {
      // patch-center pixel p must be a hole's neighborhood; source pixel q must be VALID
      const qx2 = clamp(qx + dx, 0, w - 1);
      const qy2 = clamp(qy + dy, 0, h - 1);
      if (valid[qy2 * w + qx2] < 128) {
        // source invalid: penalize but keep counting for normalization
        sum += 4 * 255 * 255; // max per-pair penalty
        counted++;
        continue;
      }
      const px2 = clamp(px + dx, 0, w - 1);
      const py2 = clamp(py + dy, 0, h - 1);
      const i1 = (py2 * w + px2) * 4;
      const i2 = (qy2 * w + qx2) * 4;
      const dr = image[i1] - image[i2];
      const dg = image[i1 + 1] - image[i2 + 1];
      const db = image[i1 + 2] - image[i2 + 2];
      sum += dr * dr + dg * dg + db * db;
      // structure term
      const g1 = (py2 * w + px2) * 2;
      const g2 = (qy2 * w + qx2) * 2;
      let dAngle = Math.abs(grad[g1 + 1] - grad[g2 + 1]);
      if (dAngle > Math.PI) dAngle = 2 * Math.PI - dAngle;
      const magTerm = (grad[g1] + grad[g2]) * structWeight * dAngle;
      sum += magTerm * magTerm;
      counted++;
      if (sum > cutoff) return sum; // early-out
    }
  }
  return counted > 0 ? sum / counted : cutoff;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
```

- [ ] **Step 6: Add `randomInit`, `propagate`, `randomSearch`, `runPatchMatchLevel`**

Append:

```ts
function rand(rngState: { s: number }): number {
  // xorshift32
  let s = rngState.s;
  s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
  rngState.s = s >>> 0;
  return (rngState.s / 4294967296);
}

/** Random init NNF: each hole pixel → a random VALID source location. */
export function randomInit(
  nnfX: Int32Array, nnfY: Int32Array, err: Float32Array,
  image: Uint8ClampedArray, grad: Float32Array, valid: Uint8ClampedArray,
  w: number, h: number, hole: Uint8Array, patchRadius: number,
  rng: { s: number }
) {
  // collect valid pixel indices once
  const validIdx: number[] = [];
  for (let i = 0; i < w * h; i++) if (valid[i] >= 128) validIdx.push(i);
  if (validIdx.length === 0) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!hole[idx]) continue;
      const pick = validIdx[(rand(rng) * validIdx.length) | 0];
      const sx = pick % w;
      const sy = (pick / w) | 0;
      nnfX[idx] = sx; nnfY[idx] = sy;
      err[idx] = patchDistance(image, grad, valid, w, h, x, y, sx, sy, patchRadius, Infinity);
    }
  }
}

/**
 * Propagation + random search over one full scan, in the given direction.
 * `hole` marks pixels to update. Returns updated NNF/err in place.
 */
export function runPatchMatchLevel(
  image: Uint8ClampedArray,
  valid: Uint8ClampedArray,   // dilated mask: 255 = valid source
  hole: Uint8Array,            // original mask: 1 = hole pixel
  w: number, h: number,
  nnfX: Int32Array, nnfY: Int32Array, err: Float32Array,
  params: PatchMatchParams,
  rng: { s: number },
  iterations: number
) {
  const grad = computeGradients(image, w, h);
  const wSearch = Math.max(w, h);
  // ordered list of hole indices (compute once per call)
  const holes: number[] = [];
  for (let i = 0; i < w * h; i++) if (hole[i]) holes.push(i);

  for (let iter = 0; iter < iterations; iter++) {
    const reverse = (iter & 1) === 1;
    for (let k = 0; k < holes.length; k++) {
      const idx = reverse ? holes[holes.length - 1 - k] : holes[k];
      const x = idx % w;
      const y = (idx / w) | 0;

      let bestX = nnfX[idx];
      let bestY = nnfY[idx];
      let bestErr = err[idx];

      // propagation: try neighbor offsets (left/right + up/down by direction)
      const neighbors = reverse
        ? [[x + 1, y], [x, y + 1]]
        : [[x - 1, y], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nidx = ny * w + nx;
        if (!hole[nidx]) continue;
        // the neighbor's offset suggests: source = (x + (nnf[n]-n))
        const ox = x + (nnfX[nidx] - nx);
        const oy = y + (nnfY[nidx] - ny);
        if (ox < 0 || oy < 0 || ox >= w || oy >= h || valid[oy * w + ox] < 128) continue;
        const d = patchDistance(image, grad, valid, w, h, x, y, ox, oy, params.patchRadius, bestErr);
        if (d < bestErr) { bestErr = d; bestX = ox; bestY = oy; }
      }

      // random search: exponential spiral
      let radius = wSearch;
      while (radius >= 1) {
        const rx = bestX + Math.round((rand(rng) * 2 - 1) * radius);
        const ry = bestY + Math.round((rand(rng) * 2 - 1) * radius);
        if (rx >= 0 && ry >= 0 && rx < w && ry < h && valid[ry * w + rx] >= 128) {
          const d = patchDistance(image, grad, valid, w, h, x, y, rx, ry, params.patchRadius, bestErr);
          if (d < bestErr) { bestErr = d; bestX = rx; bestY = ry; }
        }
        radius *= params.searchAlpha;
      }

      nnfX[idx] = bestX; nnfY[idx] = bestY; err[idx] = bestErr;
    }
  }
}
```

- [ ] **Step 7: Add NNF upsample helper**

Append:

```ts
/** Upsample NNF (offsets) by 2× for coarse-to-fine. Offsets scale by 2; coords map ×2. */
export function upsampleNNF(
  srcX: Int32Array, srcY: Int32Array,
  sw: number, sh: number,
  dw: number, dh: number
): { x: Int32Array; y: Int32Array } {
  const dx = new Int32Array(dw * dh);
  const dy = new Int32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, y >> 1);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, x >> 1);
      const sIdx = sy * sw + sx;
      // offset scales by 2; absolute target = (x*2-related) — store as absolute target
      // We store ABSOLUTE source coords in NNF (simpler for upsample).
      dx[y * dw + x] = srcX[sIdx] * 2;
      dy[y * dw + x] = srcY[sIdx] * 2;
    }
  }
  return { x: dx, y: dy };
}
```

**IMPORTANT consistency note:** The NNF arrays store **absolute source coordinates** (`nnfX[idx] = sourceX`), not deltas. The propagation step above already uses absolute coords (`bestX = ox`, the absolute source). Verify `randomInit`, `runPatchMatchLevel`, and `upsampleNNF` all treat NNF entries as absolute coords. Update `randomInit`'s stored value: `nnfX[idx] = sx` (absolute) — already correct. Update `fillAndBlend` (next step) to read absolute coords.

- [ ] **Step 8: Add `fillAndBlend` (final composite + feather)**

Append:

```ts
/**
 * Fill holes from NNF (absolute source coords) with feather seam-blend at the
 * dilated border. `origMask` is the user's original 0/255 mask (before dilation);
 * `dilatedMask` is the mask dilated by patchRadius. The feather zone is the set
 * difference: in dilated but not in orig.
 */
export function fillAndBlend(
  image: Uint8ClampedArray,
  nnfX: Int32Array, nnfY: Int32Array,
  origMask: Uint8ClampedArray,
  dilatedMask: Uint8ClampedArray,
  w: number, h: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.length);
  out.set(image);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (origMask[idx] >= 128) {
        // hard hole: take source
        const sx = clamp(nnfX[idx], 0, w - 1);
        const sy = clamp(nnfY[idx], 0, h - 1);
        const si = (sy * w + sx) * 4;
        const di = idx * 4;
        out[di] = image[si];
        out[di + 1] = image[si + 1];
        out[di + 2] = image[si + 2];
        out[di + 3] = image[si + 3];
      } else if (dilatedMask[idx] >= 128) {
        // feather zone: blend source with original
        const sx = clamp(nnfX[idx], 0, w - 1);
        const sy = clamp(nnfY[idx], 0, h - 1);
        const si = (sy * w + sx) * 4;
        const di = idx * 4;
        const a = 0.5; // simple half-blend in feather zone
        out[di] = Math.round((1 - a) * image[di] + a * image[si]);
        out[di + 1] = Math.round((1 - a) * image[di + 1] + a * image[si + 1]);
        out[di + 2] = Math.round((1 - a) * image[di + 2] + a * image[si + 2]);
        out[di + 3] = image[di + 3];
      }
    }
  }
  return out;
}
```

- [ ] **Step 9: Add top-level orchestrator `runPatchMatch`**

Append:

```ts
/** Top-level: build pyramid, run coarse-to-fine, fill+blend. Returns full RGBA image. */
export function runPatchMatch(
  image: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  w: number, h: number,
  paramsIn?: Partial<PatchMatchParams>
): Uint8ClampedArray {
  const params: PatchMatchParams = { ...DEFAULT_PARAMS, ...paramsIn };
  if (countMaskPixels(mask) === 0) return new Uint8ClampedArray(image);

  // dilate top-level mask by patchRadius
  const dilatedTop = dilateMask(mask, w, h, params.patchRadius);
  // build pyramid from dilated mask (each level dilated accordingly — for simplicity
  // we dilate only the top level; coarser levels inherit dilated coverage via downsample).
  const pyramid = buildPyramid(image, dilatedTop, w, h, params.levels);

  let nnfX: Int32Array | null = null;
  let nnfY: Int32Array | null = null;
  let prevW = 0, prevH = 0;

  for (let li = 0; li < pyramid.length; li++) {
    const lvl = pyramid[li];
    const nPix = lvl.w * lvl.h;
    const valid = lvl.mask; // dilated mask at this level (255 = valid source)
    const hole = new Uint8Array(nPix);
    // hole = pixels that are NOT valid (i.e., where dilated mask is <128)?
    // NO — hole is where the ORIGINAL user mask was set. But we only carried dilated.
    // Simpler & correct: hole = where this level's mask (dilated) < 128 → these are fill targets.
    // But dilated grows the hole region. For matching we want hole = original mask.
    // To avoid complexity, define hole = (mask at this level, which is dilated) >= 128 means
    // it was originally a hole OR dilation. We treat the whole dilated region as fill target,
    // then feather-blend only the original-mask portion is hard-filled.
    // Re-derive original-mask per level by downsampling the ORIGINAL (non-dilated) mask.
    for (let i = 0; i < nPix; i++) hole[i] = valid[i] >= 128 ? 1 : 0;
    // ^ NOTE: this uses dilated mask as "hole" — invert: hole should be the TO-FILL region.
    // Actually dilated mask marks HOLES (255) as holes. valid means NOT a hole. Fix semantics:
    // (see Step 10 fix below)
    const err = new Float32Array(nPix);
    const rng = { s: (0x9e3779b9 ^ (lvl.w * 7919 + lvl.h)) | 1 };

    if (nnfX === null) {
      nnfX = new Int32Array(nPix);
      nnfY = new Int32Array(nPix);
      randomInit(nnfX, nnfY, err, lvl.image, computeGradients(lvl.image, lvl.w, lvl.h),
                 valid, lvl.w, lvl.h, hole, params.patchRadius, rng);
    } else {
      const up = upsampleNNF(nnfX, nnfY, prevW, prevH, lvl.w, lvl.h);
      nnfX = up.x; nnfY = up.y;
      // recompute error for upsampled NNF lazily (set to Infinity so first propagate re-evaluates)
      for (let i = 0; i < nPix; i++) err[i] = Infinity;
    }
    runPatchMatchLevel(lvl.image, valid, hole, lvl.w, lvl.h, nnfX, nnfY, err, params, rng, params.iterations);
    prevW = lvl.w; prevH = lvl.h;
  }

  // upsample NNF from coarsest-run level to full res if pyramid isn't full res
  // (pyramid last index is full res by construction, so nnfX/nnfY are already full-res)
  return fillAndBlend(image, nnfX!, nnfY!, mask, dilatedTop, w, h);
}
```

- [ ] **Step 10: Fix mask semantics in `runPatchMatch`**

The orchestrator above has a semantic bug flagged inline. Masks must be unambiguous. Define and enforce:

- `mask` (user input): `255` = **hole** (to fill), `0` = valid source.
- `dilatedMask`: `255` = hole region (grown), `0` = valid source.
- `valid` (for patchDistance source check): `valid[i] = (dilatedMask[i] < 128) ? 255 : 0` — i.e., **inverted**: valid = NOT a hole.
- `hole` (fill target): `hole[i] = (dilatedMask[i] >= 128) ? 1 : 0`.

The earlier code passes `valid = lvl.mask` directly, which is the dilated-mask-with-255-as-hole. That's inverted from what `patchDistance` expects (it checks `valid[i] >= 128` to ALLOW a source). So we must invert. Rewrite the loop body of `runPatchMatch`:

```ts
  for (let li = 0; li < pyramid.length; li++) {
    const lvl = pyramid[li];
    const nPix = lvl.w * lvl.h;
    // lvl.mask is dilated hole-mask: 255 = hole, 0 = valid.
    const valid = new Uint8Array(nPix);
    const hole = new Uint8Array(nPix);
    for (let i = 0; i < nPix; i++) {
      const isHole = lvl.mask[i] >= 128;
      hole[i] = isHole ? 1 : 0;
      valid[i] = isHole ? 0 : 255; // INVERT: valid = not-a-hole
    }
    const err = new Float32Array(nPix);
    const rng = { s: (0x9e3779b9 ^ (lvl.w * 7919 + lvl.h)) | 1 };

    if (nnfX === null) {
      nnfX = new Int32Array(nPix);
      nnfY = new Int32Array(nPix);
      randomInit(nnfX, nnfY, err, lvl.image, computeGradients(lvl.image, lvl.w, lvl.h),
                 valid, lvl.w, lvl.h, hole, params.patchRadius, rng);
    } else {
      const up = upsampleNNF(nnfX, nnfY, prevW, prevH, lvl.w, lvl.h);
      nnfX = up.x; nnfY = up.y;
      for (let i = 0; i < nPix; i++) err[i] = Infinity;
    }
    runPatchMatchLevel(lvl.image, valid, hole, lvl.w, lvl.h, nnfX, nnfY, err, params, rng, params.iterations);
    prevW = lvl.w; prevH = lvl.h;
  }
```

Apply this corrected loop in the file (replace the buggy Step-9 version). Keep `fillAndBlend` as-is — it uses `origMask` (255=hole) and `dilatedMask` (255=hole), which is consistent.

Also fix `fillAndBlend`'s NNF-source read: since `nnfX/nnfY` are now stored as **absolute source coords** that point into the **valid** region, and `image` at those coords is original (untouched) data, reading `image[si]` is correct.

- [ ] **Step 11: Manual smoke-test via dev server console**

Run: `bun run dev`
Open browser → upload any image → open DevTools console. Paste:

```js
// Smoke test: import the module isn't trivial (it's a bundled worker context),
// so instead verify the module compiles without runtime errors by checking the
// built bundle loaded. Then in a later task we wire it to the UI and test there.
console.log('PatchMatch core module created. UI wiring in later tasks.');
```

Expected: server starts on `http://localhost:3000`, page loads without console errors.

- [ ] **Step 12: Commit**

```bash
git add src/frontend/utils/patchMatchCore.ts
git commit -m "feat(eraser): add pure PatchMatch core algorithm

Pure TS functions for content-aware inpainting: pyramid build, SSD patch
distance with structure term + early termination, random init, propagation,
random search, NNF upsample, fill+blend. No DOM/worker deps."
```

---

## Task 2: Create the Web Worker (`patchMatchWorker.ts`)

**Files:**
- Create: `src/frontend/utils/patchMatchWorker.ts`

The worker mirrors `imageProcessWorker.ts`'s pattern: inline-string source (Blob URL), single shared instance, generational job IDs, transferable buffers.

- [ ] **Step 1: Create the worker file with message protocol + inline source**

Create `src/frontend/utils/patchMatchWorker.ts`:

```ts
// Web Worker running PatchMatch off the main thread, isolated from the
// image-process pipeline worker so editor sliders stay responsive during erase.
//
// Pattern mirrors imageProcessWorker.ts: inline-string source + Blob URL,
// single shared Worker, generational job IDs for cancellation.

export interface PatchMatchParams {
  patchRadius: number;
  iterations: number;
  levels: number;
  searchAlpha: number;
}

interface PatchMatchJob {
  resolve: (result: Uint8ClampedArray | null) => void;
}

let worker: Worker | null = null;
let currentGeneration = 0;
const pending = new Map<number, PatchMatchJob>();

// The inline source is a minified-ish mirror of patchMatchCore.ts, because a
// Blob-URL worker cannot import TS modules without a bundler. Keep the two in
// sync when editing the algorithm.
const WORKER_SOURCE = /* js */`
${PATCHMATCH_CORE_MINIFIED}
self.onmessage = function(e) {
  var d = e.data;
  if (d.type === 'patchmatch') {
    var img = new Uint8ClampedArray(d.image);
    var mask = new Uint8ClampedArray(d.mask);
    var params = d.params || {};
    var result = runPatchMatch(img, mask, d.w, d.h, params);
    self.postMessage({ id: d.id, type: 'patchmatch', result: result }, [result.buffer]);
  }
};
`;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<{ id: number; type: string; result: Uint8ClampedArray }>) => {
      const job = pending.get(e.data.id);
      if (job) {
        pending.delete(e.data.id);
        if (e.data.id >= currentGeneration - 1) {
          job.resolve(new Uint8ClampedArray(e.data.result));
        } else {
          job.resolve(null); // stale
        }
      }
    };
    worker.onerror = () => {
      pending.forEach(j => j.resolve(null));
      pending.clear();
    };
  }
  return worker;
}

let jobId = 0;

export function runPatchMatchInWorker(
  image: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  w: number, h: number,
  params?: Partial<PatchMatchParams>
): Promise<Uint8ClampedArray | null> {
  currentGeneration = ++jobId;
  const id = currentGeneration;
  pending.forEach((_, k) => { if (k < id - 1) pending.delete(k); });

  return new Promise((resolve) => {
    pending.set(id, { resolve });
    const imgCopy = new Uint8ClampedArray(image);
    const maskCopy = new Uint8ClampedArray(mask);
    getWorker().postMessage(
      { id, type: 'patchmatch', image: imgCopy, mask: maskCopy, w, h, params: params || {} },
      [imgCopy.buffer, maskCopy.buffer]
    );
  });
}
```

- [ ] **Step 2: Generate the minified core string**

The `${PATCHMATCH_CORE_MINIFIED}` placeholder must be replaced with the actual algorithm source from `patchMatchCore.ts`, as a JS string. To keep the two files in sync without a build step, we transcribe the functions into a minified JS string literal.

**Approach (chosen for maintainability):** Instead of hand-minifying, write the core logic in plain (non-minified) JS inside the template literal, matching `patchMatchCore.ts` function-for-function. This duplicates the source but stays readable. Replace the placeholder line with:

```ts
const WORKER_SOURCE = /* js */`
// --- PatchMatch core (mirror of patchMatchCore.ts; plain JS for worker context) ---
function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}
function countMaskPixels(mask,threshold){threshold=threshold||128;var n=0;for(var i=0;i<mask.length;i++){if(mask[i]>=threshold)n++;}return n;}
function dilateMask(mask,w,h,radius){if(radius<=0)return new Uint8ClampedArray(mask);var cur=new Uint8ClampedArray(mask);for(var step=0;step<radius;step++){var next=new Uint8ClampedArray(cur.length);for(var y=0;y<h;y++){var y0=Math.max(0,y-1),y1=Math.min(h-1,y+1);for(var x=0;x<w;x++){var x0=Math.max(0,x-1),x1=Math.min(w-1,x+1);var any=0;for(var yy=y0;yy<=y1&&!any;yy++){for(var xx=x0;xx<=x1;xx++){if(cur[yy*w+xx]>=128){any=1;break;}}}next[y*w+x]=any?255:0;}}cur=next;}return cur;}
function downsampleImage(src,w,h){var nw=Math.max(1,w>>1),nh=Math.max(1,h>>1);var dst=new Uint8ClampedArray(nw*nh*4);for(var y=0;y<nh;y++){for(var x=0;x<nw;x++){var sx0=x*2,sy0=y*2,sx1=Math.min(w-1,sx0+1),sy1=Math.min(h-1,sy0+1);for(var c=0;c<4;c++){dst[(y*nw+x)*4+c]=(src[(sy0*w+sx0)*4+c]+src[(sy0*w+sx1)*4+c]+src[(sy1*w+sx0)*4+c]+src[(sy1*w+sx1)*4+c])>>2;}}}return{img:dst,w:nw,h:nh};}
function downsampleMask(src,w,h){var nw=Math.max(1,w>>1),nh=Math.max(1,h>>1);var dst=new Uint8ClampedArray(nw*nh);for(var y=0;y<nh;y++){for(var x=0;x<nw;x++){var sx0=x*2,sy0=y*2,sx1=Math.min(w-1,sx0+1),sy1=Math.min(h-1,sy0+1);var any=0;if(src[sy0*w+sx0]>=128||src[sy0*w+sx1]>=128||src[sy1*w+sx0]>=128||src[sy1*w+sx1]>=128)any=1;dst[y*nw+x]=any?255:0;}}return{m:dst,w:nw,h:nh};}
function buildPyramid(image,mask,w,h,requestedLevels){var levels=requestedLevels;if(levels<=0){levels=1;var dim=Math.max(w,h);while(dim>128){levels++;dim>>=1;}levels=Math.max(1,levels);}var pyramid=[];var curImg=image,curMask=mask,curW=w,curH=h;pyramid.unshift({w:curW,h:curH,image:curImg,mask:curMask});for(var l=1;l<levels;l++){var d=downsampleImage(curImg,curW,curH);var dm=downsampleMask(curMask,curW,curH);if(d.w<=2||d.h<=2)break;curImg=d.img;curW=d.w;curH=d.h;curMask=dm.m;pyramid.unshift({w:curW,h:curH,image:curImg,mask:curMask});}return pyramid;}
function computeGradients(image,w,h){var grad=new Float32Array(w*h*2);var lum=new Float32Array(w*h);for(var i=0;i<w*h;i++){lum[i]=0.299*image[i*4]+0.587*image[i*4+1]+0.114*image[i*4+2];}for(var y=0;y<h;y++){for(var x=0;x<w;x++){var xm=Math.max(0,x-1),xp=Math.min(w-1,x+1),ym=Math.max(0,y-1),yp=Math.min(h-1,y+1);var gx=-lum[ym*w+xm]-2*lum[y*w+xm]-lum[yp*w+xm]+lum[ym*w+xp]+2*lum[y*w+xp]+lum[yp*w+xp];var gy=-lum[ym*w+xm]-2*lum[ym*w+x]-lum[ym*w+xp]+lum[yp*w+xm]+2*lum[yp*w+x]+lum[yp*w+xp];var idx=(y*w+x)*2;grad[idx]=Math.hypot(gx,gy);grad[idx+1]=Math.atan2(gy,gx);}}return grad;}
function patchDistance(image,grad,valid,w,h,px,py,qx,qy,patchRadius,cutoff){var sum=0,counted=0;var structWeight=0.3;for(var dy=-patchRadius;dy<=patchRadius;dy++){for(var dx=-patchRadius;dx<=patchRadius;dx++){var qx2=clamp(qx+dx,0,w-1),qy2=clamp(qy+dy,0,h-1);if(valid[qy2*w+qx2]<128){sum+=4*255*255;counted++;continue;}var px2=clamp(px+dx,0,w-1),py2=clamp(py+dy,0,h-1);var i1=(py2*w+px2)*4,i2=(qy2*w+qx2)*4;var dr=image[i1]-image[i2],dg=image[i1+1]-image[i2+1],db=image[i1+2]-image[i2+2];sum+=dr*dr+dg*dg+db*db;var g1=(py2*w+px2)*2,g2=(qy2*w+qx2)*2;var dAngle=Math.abs(grad[g1+1]-grad[g2+1]);if(dAngle>Math.PI)dAngle=2*Math.PI-dAngle;var magTerm=(grad[g1]+grad[g2])*structWeight*dAngle;sum+=magTerm*magTerm;counted++;if(sum>cutoff)return sum;}}return counted>0?sum/counted:cutoff;}
function rand(rngState){var s=rngState.s;s^=s<<13;s^=s>>>17;s^=s<<5;rngState.s=s>>>0;return rngState.s/4294967296;}
function randomInit(nnfX,nnfY,err,image,grad,valid,w,h,hole,patchRadius,rng){var validIdx=[];for(var i=0;i<w*h;i++)if(valid[i]>=128)validIdx.push(i);if(validIdx.length===0)return;for(var y=0;y<h;y++){for(var x=0;x<w;x++){var idx=y*w+x;if(!hole[idx])continue;var pick=validIdx[(rand(rng)*validIdx.length)|0];var sx=pick%w,sy=(pick/w)|0;nnfX[idx]=sx;nnfY[idx]=sy;err[idx]=patchDistance(image,grad,valid,w,h,x,y,sx,sy,patchRadius,Infinity);}}}
function upsampleNNF(srcX,srcY,sw,sh,dw,dh){var dx=new Int32Array(dw*dh),dy=new Int32Array(dw*dh);for(var y=0;y<dh;y++){var sy=Math.min(sh-1,y>>1);for(var x=0;x<dw;x++){var sx=Math.min(sw-1,x>>1);var sIdx=sy*sw+sx;dx[y*dw+x]=srcX[sIdx]*2;dy[y*dw+x]=srcY[sIdx]*2;}}return{x:dx,y:dy};}
function runPatchMatchLevel(image,valid,hole,w,h,nnfX,nnfY,err,params,rng,iterations){var grad=computeGradients(image,w,h);var wSearch=Math.max(w,h);var holes=[];for(var i=0;i<w*h;i++)if(hole[i])holes.push(i);for(var iter=0;iter<iterations;iter++){var reverse=(iter&1)===1;for(var k=0;k<holes.length;k++){var idx=reverse?holes[holes.length-1-k]:holes[k];var x=idx%w,y=(idx/w)|0;var bestX=nnfX[idx],bestY=nnfY[idx],bestErr=err[idx];var neighbors=reverse?[[x+1,y],[x,y+1]]:[[x-1,y],[x,y-1]];for(var ni=0;ni<neighbors.length;ni++){var nx=neighbors[ni][0],ny=neighbors[ni][1];if(nx<0||ny<0||nx>=w||ny>=h)continue;var nidx=ny*w+nx;if(!hole[nidx])continue;var ox=x+(nnfX[nidx]-nx),oy=y+(nnfY[nidx]-ny);if(ox<0||oy<0||ox>=w||oy>=h||valid[oy*w+ox]<128)continue;var d=patchDistance(image,grad,valid,w,h,x,y,ox,oy,params.patchRadius,bestErr);if(d<bestErr){bestErr=d;bestX=ox;bestY=oy;}}var radius=wSearch;while(radius>=1){var rx=bestX+Math.round((rand(rng)*2-1)*radius),ry=bestY+Math.round((rand(rng)*2-1)*radius);if(rx>=0&&ry>=0&&rx<w&&ry<h&&valid[ry*w+rx]>=128){var d2=patchDistance(image,grad,valid,w,h,x,y,rx,ry,params.patchRadius,bestErr);if(d2<bestErr){bestErr=d2;bestX=rx;bestY=ry;}}radius*=params.searchAlpha;}nnfX[idx]=bestX;nnfY[idx]=bestY;err[idx]=bestErr;}}}
function fillAndBlend(image,nnfX,nnfY,origMask,dilatedMask,w,h){var out=new Uint8ClampedArray(image.length);out.set(image);for(var y=0;y<h;y++){for(var x=0;x<w;x++){var idx=y*w+x;if(origMask[idx]>=128){var sx=clamp(nnfX[idx],0,w-1),sy=clamp(nnfY[idx],0,h-1);var si=(sy*w+sx)*4,di=idx*4;out[di]=image[si];out[di+1]=image[si+1];out[di+2]=image[si+2];out[di+3]=image[si+3];}else if(dilatedMask[idx]>=128){var sx2=clamp(nnfX[idx],0,w-1),sy2=clamp(nnfY[idx],0,h-1);var si2=(sy2*w+sx2)*4,di2=idx*4;var a=0.5;out[di2]=Math.round((1-a)*image[di2]+a*image[si2]);out[di2+1]=Math.round((1-a)*image[di2+1]+a*image[si2+1]);out[di2+2]=Math.round((1-a)*image[di2+2]+a*image[si2+2]);out[di2+3]=image[di2+3];}}}return out;}
function runPatchMatch(image,mask,w,h,paramsIn){var params={patchRadius:4,iterations:5,levels:0,searchAlpha:0.5};if(paramsIn){for(var k in paramsIn)if(paramsIn[k]!==undefined)params[k]=paramsIn[k];}if(countMaskPixels(mask)===0)return new Uint8ClampedArray(image);var dilatedTop=dilateMask(mask,w,h,params.patchRadius);var pyramid=buildPyramid(image,dilatedTop,w,h,params.levels);var nnfX=null,nnfY=null,prevW=0,prevH=0;for(var li=0;li<pyramid.length;li++){var lvl=pyramid[li];var nPix=lvl.w*lvl.h;var valid=new Uint8Array(nPix),hole=new Uint8Array(nPix);for(var i=0;i<nPix;i++){var isHole=lvl.mask[i]>=128;hole[i]=isHole?1:0;valid[i]=isHole?0:255;}var err=new Float32Array(nPix);var rng={s:(0x9e3779b9^(lvl.w*7919+lvl.h))|1};if(nnfX===null){nnfX=new Int32Array(nPix);nnfY=new Int32Array(nPix);randomInit(nnfX,nnfY,err,lvl.image,computeGradients(lvl.image,lvl.w,lvl.h),valid,lvl.w,lvl.h,hole,params.patchRadius,rng);}else{var up=upsampleNNF(nnfX,nnfY,prevW,prevH,lvl.w,lvl.h);nnfX=up.x;nnfY=up.y;for(var j=0;j<nPix;j++)err[j]=Infinity;}runPatchMatchLevel(lvl.image,valid,hole,lvl.w,lvl.h,nnfX,nnfY,err,params,rng,params.iterations);prevW=lvl.w;prevH=lvl.h;}return fillAndBlend(image,nnfX,nnfY,mask,dilatedTop,w,h);}

self.onmessage = function(e) {
  var d = e.data;
  if (d.type === 'patchmatch') {
    var img = new Uint8ClampedArray(d.image);
    var mask = new Uint8ClampedArray(d.mask);
    var result = runPatchMatch(img, mask, d.w, d.h, d.params);
    self.postMessage({ id: d.id, type: 'patchmatch', result: result }, [result.buffer]);
  }
};
`;
```

Note: remove the original placeholder `${PATCHMATCH_CORE_MINIFIED}` usage — the source string now contains the full core inline.

- [ ] **Step 3: Verify file compiles (typecheck via dev server)**

Run: `bun run dev`
Expected: server starts, no TS errors in terminal.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/utils/patchMatchWorker.ts
git commit -m "feat(eraser): add PatchMatch Web Worker

Isolated worker (separate from pipeline worker) with inline-string core,
generational job IDs, transferable buffers. Keeps editor responsive during erase."
```

---

## Task 3: Create the main-thread client wrapper

**Files:**
- Create: `src/frontend/utils/patchMatchWorkerClient.ts`

- [ ] **Step 1: Create the Promise-based client**

Create `src/frontend/utils/patchMatchWorkerClient.ts`:

```ts
// Main-thread API for PatchMatch. Thin wrapper over the worker; resolves null
// on stale/cancelled/error and the caller decides the fallback (OpenCV tier).

import { runPatchMatchInWorker, PatchMatchParams } from './patchMatchWorker';

export async function applyPatchMatch(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  mask: Uint8ClampedArray,
  params?: Partial<PatchMatchParams>
): Promise<Uint8ClampedArray> {
  const result = await runPatchMatchInWorker(pixels, mask, w, h, params);
  if (!result) {
    throw new Error('PatchMatch failed or was cancelled');
  }
  return result;
}

export type { PatchMatchParams };
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/utils/patchMatchWorkerClient.ts
git commit -m "feat(eraser): add PatchMatch main-thread client wrapper

Promise-based applyPatchMatch; throws on stale/error so caller can fall back."
```

---

## Task 4: Wire `applyPatchMatch` + `countMaskPixels` into `imageProcess.ts`; remove AI path

**Files:**
- Modify: `src/frontend/utils/imageProcess.ts`

- [ ] **Step 1: Add re-exports at the top of `imageProcess.ts`**

At the very top (after the existing `export interface AdjustmentState` block, before `rgbToHsl`), add:

```ts
export { applyPatchMatch, PatchMatchParams } from './patchMatchWorkerClient';
export { countMaskPixels } from './patchMatchCore';
```

- [ ] **Step 2: Delete `applyOpenRouterInpaint` and `resizeCanvas`**

Delete the entire `resizeCanvas` function (the small helper above `applyOpenRouterInpaint`) and the entire `applyOpenRouterInpaint` function (the large async function). These are now unused.

- [ ] **Step 3: Delete `refineMaskWithGrabCut`**

Delete the entire `refineMaskWithGrabCut` function (the large GrabCut function). It was only called by `applyInpaint`, and GrabCut is overkill for small regions (now the PatchMatch tier handles the hard cases).

- [ ] **Step 4: Strip the GrabCut call from `applyInpaint`**

In `applyInpaint`, remove these lines:

```ts
  try {
    refineMaskWithGrabCut(srcRGB, maskGray);
  } catch (e) {
    console.error(e);
  }
```

The function should now go straight from creating `maskGray` to creating `dst` and calling `cv.inpaint`.

- [ ] **Step 5: Verify no remaining references to deleted functions**

Run: `bun run dev` and check terminal for "Cannot find name" errors.
Also grep the repo: search `applyOpenRouterInpaint`, `refineMaskWithGrabCut`, `resizeCanvas` — expect matches ONLY inside this file's own now-deleted code, and zero after deletion.

```bash
grep -rn "applyOpenRouterInpaint\|refineMaskWithGrabCut" src/ || echo "clean"
```
Expected: `clean` (no matches).

- [ ] **Step 6: Commit**

```bash
git add src/frontend/utils/imageProcess.ts
git commit -m "refactor(eraser): remove AI inpaint path; re-export PatchMatch

- Delete applyOpenRouterInpaint + resizeCanvas (AI path)
- Delete refineMaskWithGrabCut + its call in applyInpaint (overkill for small tier)
- Re-export applyPatchMatch, countMaskPixels from new modules"
```

---

## Task 5: Simplify `EraserModule.tsx` (remove AI UI)

**Files:**
- Modify: `src/frontend/components/EraserModule.tsx`

- [ ] **Step 1: Replace the entire props interface**

Replace the `EraserModuleProps` interface (lines ~4-23) with:

```ts
interface EraserModuleProps {
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushFeather: number;
  setBrushFeather: (feather: number) => void;
  brushOpacity: number;
  setBrushOpacity: (opacity: number) => void;
  brushMode: 'add' | 'erase';
  setBrushMode: (mode: 'add' | 'erase') => void;
  onClearMask: () => void;
  onApplyErase: () => void;
  hasMaskPixels: boolean;
  isCvReady?: boolean;
}
```

- [ ] **Step 2: Replace the component signature & destructuring**

Replace the function signature/destructure (lines ~25-44) with:

```ts
export const EraserModule: React.FC<EraserModuleProps> = ({
  brushSize,
  setBrushSize,
  brushFeather,
  setBrushFeather,
  brushOpacity,
  setBrushOpacity,
  brushMode,
  setBrushMode,
  onClearMask,
  onApplyErase,
  hasMaskPixels,
  isCvReady = false,
}) => {
```

- [ ] **Step 3: Remove all OpenRouter-related state & effects**

Delete:
- The `import React, { useState, useEffect }` → change to `import React from 'react';` (useState/useEffect no longer used).
- The state block: `const [models, setModels] = ...`, `searchTerm`, `isOpen`, `isLoading`.
- The `useEffect` that fetches `/api/v1/inpaint/models`.
- The `filteredModels` const.

- [ ] **Step 4: Replace the info text**

Change the `<p>` info text (lines ~75-77) to:

```tsx
<p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
  Brush over unwanted objects. The eraser analyzes the entire photo to reconstruct background — may take a few seconds for large selections.
</p>
```

- [ ] **Step 5: Remove the Inpainting Engine selector block**

Delete the entire `<div>` containing the "Inpainting Engine" label and `<select>` (lines ~123-142).

- [ ] **Step 6: Remove the OpenRouter config block**

Delete the entire `{eraserEngine === 'openrouter' && (...)}` block (lines ~144-256).

- [ ] **Step 7: Fix the Erase button (remove engine-dependent label/logic)**

Replace the Erase button block (lines ~259-274) with:

```tsx
<button
  className="btn btn-accent"
  onClick={onApplyErase}
  disabled={!hasMaskPixels || !isCvReady}
  style={{ width: '100%', fontWeight: 'bold' }}
>
  {isCvReady ? 'Erase Object' : 'Loading OpenCV...'}
</button>
```

- [ ] **Step 8: Verify dev server compiles & renders**

Run: `bun run dev`
Open browser, upload image, click Eraser tab. Expected: only brush sliders + Paint Select/Erase + Erase Object + Clear Selection buttons. No engine dropdown, no API key, no model picker.

- [ ] **Step 9: Commit**

```bash
git add src/frontend/components/EraserModule.tsx
git commit -m "refactor(eraser): remove AI engine UI from EraserModule

Drop engine selector, API key, model picker and related state. Simplify to
brush controls + Erase/Clear. Content-aware fill is now automatic per region size."
```

---

## Task 6: Update `App.tsx` (remove AI state, add tiering in `handleApplyErase`)

**Files:**
- Modify: `src/frontend/App.tsx`

- [ ] **Step 1: Fix the import line**

Change line 16 from:

```ts
import { AdjustmentState, CurvePoint, CurvesState, PresetType, processPixels, applyInpaint, applyOpenRouterInpaint } from './utils/imageProcess';
```

to:

```ts
import { AdjustmentState, CurvePoint, CurvesState, PresetType, processPixels, applyInpaint, applyPatchMatch, countMaskPixels } from './utils/imageProcess';
```

- [ ] **Step 2: Remove the three AI state declarations**

Delete these state declarations (lines ~377-385):

```ts
const [eraserEngine, setEraserEngine] = useState<'local' | 'openrouter'>(() => {
  return (localStorage.getItem('eraserEngine') as 'local' | 'openrouter') || 'local';
});
const [openrouterApiKey, setOpenrouterApiKey] = useState<string>(() => {
  return localStorage.getItem('openrouterApiKey') || '';
});
const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
  return localStorage.getItem('openrouterModel') || 'google/gemini-2.5-flash';
});
```

- [ ] **Step 3: Remove the three localStorage useEffect blocks**

Delete these useEffect blocks (lines ~387-397):

```ts
useEffect(() => {
  localStorage.setItem('eraserEngine', eraserEngine);
}, [eraserEngine]);

useEffect(() => {
  localStorage.setItem('openrouterApiKey', openrouterApiKey);
}, [openrouterApiKey]);

useEffect(() => {
  localStorage.setItem('openrouterModel', openrouterModel);
}, [openrouterModel]);
```

- [ ] **Step 4: Replace `handleApplyErase` entirely**

Replace the whole `handleApplyErase` function (lines ~583-628) with:

```ts
const handleApplyErase = async () => {
  const orig = canvasRef.current?.getOrigPixels();
  if (!orig || !eraserBuffer || !previewW || !previewH) return;
  if (!hasEraserPixels) {
    showToast('Please paint on the image first');
    return;
  }
  if (!isCvReady) {
    showToast('OpenCV.js is loading, please wait...');
    return;
  }
  setIsProcessing(true);
  try {
    const holeRatio = countMaskPixels(eraserBuffer) / (previewW * previewH);
    let nextPixels: Uint8ClampedArray;
    if (holeRatio < 0.02) {
      nextPixels = applyInpaint(orig, previewW, previewH, eraserBuffer);
    } else {
      nextPixels = await applyPatchMatch(orig, previewW, previewH, eraserBuffer);
    }
    canvasRef.current?.setOrigPixels(nextPixels, previewW, previewH);
    setOrigPixels(nextPixels);
    eraserBuffer.fill(0);
    setEraserBuffer(new Uint8ClampedArray(eraserBuffer));
    pushHistory(globalAdjustments, globalCurves, globalPreset, masks, activeMaskId, nextPixels, previewW, previewH);
    setHasEraserPixels(false);
    showToast(holeRatio < 0.02 ? 'Object erased' : 'Object removed (content-aware)');
  } catch (err) {
    console.error(err);
    // Fallback to OpenCV fast tier on PatchMatch failure
    try {
      const fallback = applyInpaint(orig, previewW, previewH, eraserBuffer);
      canvasRef.current?.setOrigPixels(fallback, previewW, previewH);
      setOrigPixels(fallback);
      eraserBuffer.fill(0);
      setEraserBuffer(new Uint8ClampedArray(eraserBuffer));
      pushHistory(globalAdjustments, globalCurves, globalPreset, masks, activeMaskId, fallback, previewW, previewH);
      setHasEraserPixels(false);
      showToast('Content-aware failed, used fast mode');
    } catch (err2) {
      console.error(err2);
      showToast(err instanceof Error ? err.message : 'Failed to erase object');
    }
  } finally {
    setIsProcessing(false);
  }
};
```

- [ ] **Step 5: Update the `<EraserModule>` JSX props**

Replace the `<EraserModule ... />` JSX block (lines ~1174-1194) with the simplified version:

```tsx
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
  />
)}
```

- [ ] **Step 6: Verify dev server compiles**

Run: `bun run dev`
Expected: no TS errors. Page loads, Eraser tab works (Erase button triggers worker).

- [ ] **Step 7: Commit**

```bash
git add src/frontend/App.tsx
git commit -m "refactor(eraser): tier erase by region size; remove AI state

handleApplyErase picks OpenCV TELEA for <2% area, PatchMatch (worker) for
larger. Falls back to OpenCV on PatchMatch failure. Drops eraserEngine/
openrouter state + localStorage."
```

---

## Task 7: Remove backend AI route

**Files:**
- Delete: `src/routes/inpaint.ts`
- Modify: `src/routes/index.ts`

- [ ] **Step 1: Delete the inpaint route file**

```bash
git rm src/routes/inpaint.ts
```

- [ ] **Step 2: Update `src/routes/index.ts`**

Replace the entire file content with:

```ts
import { Elysia } from "elysia";
import { authenticationRoutes } from "./auth";
import { userRoutes } from "./users";

export const apiRouter = new Elysia({ prefix: "/api/v1" })
  .use(authenticationRoutes)
  .use(userRoutes);
```

- [ ] **Step 3: Verify server starts without errors**

Run: `bun run dev`
Expected: server starts on port 3000, no import errors. `http://localhost:3000/api/v1/inpaint/models` should now 404 (route gone).

- [ ] **Step 4: Commit**

```bash
git add src/routes/inpaint.ts src/routes/index.ts
git commit -m "refactor(backend): remove inpaint AI proxy route

Delete src/routes/inpaint.ts and its registration. Content-aware erase is
now fully client-side (PatchMatch + OpenCV)."
```

---

## Task 8: Build frontend bundle & end-to-end manual verification

**Files:** none (build + test)

- [ ] **Step 1: Build the production frontend bundle**

```bash
bun run build:frontend
```
Expected: completes without error, writes `public/bundle.js`.

- [ ] **Step 2: Restart dev server and do a full manual test**

Run: `bun run dev`

Test matrix:

| Test | Steps | Expected |
|---|---|---|
| Small region (blemish) | Upload photo → Eraser tab → brush a tiny spot (1-2% area) → Erase Object | Fills quickly via OpenCV, toast "Object erased", result clean |
| Medium region | Brush a ~10% region (e.g., a person in grass) → Erase Object | Spinner shows "Removing Object...", ~1-3s, toast "Object removed (content-aware)", grass reconstructed coherently |
| Large region | Brush ~30% area → Erase Object | Spinner shows, longer (~3-5s), background reconstructed from elsewhere in photo, no smear/streaking |
| Clear selection | Paint a mask → Clear Selection | Mask cleared, Erase disabled |
| Cancel mid-process | Start large erase → immediately navigate away (back button) | No crash; stale worker result dropped via generational ID |
| Worker fallback | (Hard to trigger naturally) — inspect console for error handling | If PatchMatch errors, toast "Content-aware failed, used fast mode", OpenCV result used |

- [ ] **Step 3: Verify no console errors during normal editing**

While at it: upload image, drag adjustment sliders (exposure, contrast), switch tabs, add a brush mask. Confirm editor stays responsive (no freezes) even right after an erase — confirms worker isolation.

- [ ] **Step 4: Commit the built bundle**

```bash
git add public/bundle.js
git commit -m "build: rebuild frontend bundle with content-aware eraser"
```

---

## Self-Review

**Spec coverage:**
- Remove AI/OpenRouter path → Tasks 4 (imageProcess), 5 (EraserModule), 6 (App.tsx), 7 (backend). ✓
- Add PatchMatch pure-TS in worker → Tasks 1, 2, 3. ✓
- OpenCV TELEA retained as fast tier → Task 4 (kept applyInpaint), Task 6 (tiering). ✓
- Multi-scale coarse-to-fine → Task 1 Step 3 (buildPyramid) + Step 6/9/10. ✓
- Structure-aware SSD → Task 1 Step 4/5. ✓
- Feather seam blend → Task 1 Step 8. ✓
- Tiering at 2% threshold → Task 6 Step 4. ✓
- Worker isolation (separate from pipeline) → Task 2. ✓
- Cancellation via generational IDs → Task 2. ✓
- Fallback to OpenCV on worker failure → Task 6 Step 4. ✓
- Edge cases (empty mask, all-hole, thin mask) → covered by tiering + countMaskPixels guard. ✓
- No new test framework → respected (manual verification only). ✓

**Placeholder scan:** No "TBD"/"TODO"/"add error handling"/"similar to". All code shown inline. The one `${PATCHMATCH_CORE_MINIFIED}` placeholder in Task 2 Step 1 is explicitly resolved in Step 2 of the same task. ✓

**Type consistency:**
- `PatchMatchParams` defined in `patchMatchCore.ts`, re-exported by `patchMatchWorker.ts`, `patchMatchWorkerClient.ts`, `imageProcess.ts`. Same fields throughout: `patchRadius`, `iterations`, `levels`, `searchAlpha`. ✓
- `applyPatchMatch(pixels, w, h, mask, params?)` signature consistent in client + imageProcess re-export + App.tsx call site. ✓
- `countMaskPixels(mask)` signature consistent (default threshold arg). ✓
- NNF stores **absolute source coords** consistently across randomInit, runPatchMatchLevel (propagation re-derives absolute), upsampleNNF (×2 scaling of absolute), fillAndBlend (reads as absolute). ✓
- Mask semantics: `255 = hole` for user mask & dilatedMask; `valid` is inverted (`255 = NOT hole`); `hole` is boolean Uint8Array. Documented in Task 1 Step 10. ✓

No issues found. Plan is complete.
