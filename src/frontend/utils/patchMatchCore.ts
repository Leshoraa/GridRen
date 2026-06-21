// Pure PatchMatch inpainting — no DOM, no worker, no side effects.

export interface PatchMatchParams {
  patchRadius: number;
  iterations: number;
  levels: number;
  searchAlpha: number;
}

export const DEFAULT_PARAMS: PatchMatchParams = {
  patchRadius: 4,
  iterations: 5,
  levels: 0,
  searchAlpha: 0.5,
};

export function countMaskPixels(mask: Uint8ClampedArray, threshold = 128): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] >= threshold) n++;
  }
  return n;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dilateMask(
  mask: Uint8ClampedArray, w: number, h: number, radius: number
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(mask);
  let cur = new Uint8ClampedArray(mask);
  for (let step = 0; step < radius; step++) {
    const next = new Uint8ClampedArray(cur.length);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
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

export interface PyramidLevel {
  w: number; h: number;
  image: Uint8ClampedArray;
  mask: Uint8ClampedArray;
}

function downsampleImage(src: Uint8ClampedArray, w: number, h: number) {
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
  const dst = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx0 = x * 2, sy0 = y * 2;
      const sx1 = Math.min(w - 1, sx0 + 1), sy1 = Math.min(h - 1, sy0 + 1);
      for (let c = 0; c < 4; c++) {
        dst[(y * nw + x) * 4 + c] = (
          src[(sy0 * w + sx0) * 4 + c] + src[(sy0 * w + sx1) * 4 + c] +
          src[(sy1 * w + sx0) * 4 + c] + src[(sy1 * w + sx1) * 4 + c]
        ) >> 2;
      }
    }
  }
  return { img: dst, w: nw, h: nh };
}

function downsampleMask(src: Uint8ClampedArray, w: number, h: number) {
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
  const dst = new Uint8ClampedArray(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx0 = x * 2, sy0 = y * 2;
      const sx1 = Math.min(w - 1, sx0 + 1), sy1 = Math.min(h - 1, sy0 + 1);
      if (src[sy0 * w + sx0] >= 128 || src[sy0 * w + sx1] >= 128 ||
          src[sy1 * w + sx0] >= 128 || src[sy1 * w + sx1] >= 128) {
        dst[y * nw + x] = 255;
      }
    }
  }
  return { m: dst, w: nw, h: nh };
}

export function buildPyramid(
  image: Uint8ClampedArray, mask: Uint8ClampedArray,
  w: number, h: number, requestedLevels: number
): PyramidLevel[] {
  let levels = requestedLevels;
  if (levels <= 0) {
    levels = 1;
    let dim = Math.max(w, h);
    while (dim > 128) { levels++; dim >>= 1; }
    levels = Math.max(1, levels);
  }
  const pyramid: PyramidLevel[] = [];
  let curImg = image, curMask = mask, curW = w, curH = h;
  pyramid.unshift({ w: curW, h: curH, image: curImg, mask: curMask });
  for (let l = 1; l < levels; l++) {
    const d = downsampleImage(curImg, curW, curH);
    const dm = downsampleMask(curMask, curW, curH);
    if (d.w <= 2 || d.h <= 2) break;
    curImg = d.img; curW = d.w; curH = d.h; curMask = dm.m;
    pyramid.unshift({ w: curW, h: curH, image: curImg, mask: curMask });
  }
  return pyramid;
}

export function computeGradients(image: Uint8ClampedArray, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h * 2);
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

export function patchDistance(
  image: Uint8ClampedArray, grad: Float32Array, valid: Uint8ClampedArray,
  w: number, h: number,
  px: number, py: number, qx: number, qy: number,
  patchRadius: number, cutoff: number
): number {
  let sum = 0, counted = 0;
  for (let dy = -patchRadius; dy <= patchRadius; dy++) {
    for (let dx = -patchRadius; dx <= patchRadius; dx++) {
      const qx2 = clamp(qx + dx, 0, w - 1), qy2 = clamp(qy + dy, 0, h - 1);
      // Hard reject: source patch must not sample the hole.
      if (valid[qy2 * w + qx2] < 128) return Infinity;
      const px2 = clamp(px + dx, 0, w - 1), py2 = clamp(py + dy, 0, h - 1);
      const i1 = (py2 * w + px2) * 4, i2 = (qy2 * w + qx2) * 4;
      const dr = image[i1] - image[i2], dg = image[i1 + 1] - image[i2 + 1], db = image[i1 + 2] - image[i2 + 2];
      sum += dr * dr + dg * dg + db * db;
      counted++;
      if (sum > cutoff * counted) return sum / Math.max(1, counted);
    }
  }
  return counted > 0 ? sum / counted : Infinity;
}

function rand(rng: { s: number }): number {
  let s = rng.s;
  s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
  rng.s = s >>> 0;
  return rng.s / 4294967296;
}

export function randomInit(
  nnfX: Int32Array, nnfY: Int32Array, err: Float32Array,
  image: Uint8ClampedArray, grad: Float32Array, valid: Uint8ClampedArray,
  w: number, h: number, hole: Uint8Array, patchRadius: number, rng: { s: number }
) {
  const validIdx: number[] = [];
  for (let i = 0; i < w * h; i++) if (valid[i] >= 128) validIdx.push(i);
  if (validIdx.length === 0) return;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!hole[idx]) continue;
      const pick = validIdx[(rand(rng) * validIdx.length) | 0];
      nnfX[idx] = pick % w;
      nnfY[idx] = (pick / w) | 0;
      err[idx] = patchDistance(image, grad, valid, w, h, x, y, nnfX[idx], nnfY[idx], patchRadius, Infinity);
    }
  }
}

export function upsampleNNF(
  srcX: Int32Array, srcY: Int32Array, sw: number, sh: number, dw: number, dh: number
) {
  const dx = new Int32Array(dw * dh), dy = new Int32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, y >> 1);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, x >> 1);
      const sIdx = sy * sw + sx;
      dx[y * dw + x] = clamp(srcX[sIdx] * 2, 0, dw - 1);
      dy[y * dw + x] = clamp(srcY[sIdx] * 2, 0, dh - 1);
    }
  }
  return { x: dx, y: dy };
}

export function runPatchMatchLevel(
  image: Uint8ClampedArray, valid: Uint8ClampedArray, hole: Uint8Array,
  w: number, h: number,
  nnfX: Int32Array, nnfY: Int32Array, err: Float32Array,
  params: PatchMatchParams, rng: { s: number }, iterations: number
) {
  const grad = computeGradients(image, w, h);
  const wSearch = Math.max(w, h);
  const holes: number[] = [];
  for (let i = 0; i < w * h; i++) if (hole[i]) holes.push(i);

  for (let iter = 0; iter < iterations; iter++) {
    const reverse = (iter & 1) === 1;
    for (let k = 0; k < holes.length; k++) {
      const idx = reverse ? holes[holes.length - 1 - k] : holes[k];
      const x = idx % w, y = (idx / w) | 0;
      let bestX = nnfX[idx], bestY = nnfY[idx], bestErr = err[idx];

      // propagation
      const neighbors = reverse
        ? [[x + 1, y], [x, y + 1]]
        : [[x - 1, y], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nidx = ny * w + nx;
        if (!hole[nidx]) continue;
        const ox = x + (nnfX[nidx] - nx), oy = y + (nnfY[nidx] - ny);
        if (ox < 0 || oy < 0 || ox >= w || oy >= h || valid[oy * w + ox] < 128) continue;
        const d = patchDistance(image, grad, valid, w, h, x, y, ox, oy, params.patchRadius, bestErr);
        if (d < bestErr) { bestErr = d; bestX = ox; bestY = oy; }
      }

      // random search
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

export function fillAndBlend(
  image: Uint8ClampedArray,
  nnfX: Int32Array, nnfY: Int32Array,
  origMask: Uint8ClampedArray, dilatedMask: Uint8ClampedArray,
  w: number, h: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(image.length);
  out.set(image);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (origMask[idx] >= 128) {
        const sx = clamp(nnfX[idx], 0, w - 1), sy = clamp(nnfY[idx], 0, h - 1);
        const si = (sy * w + sx) * 4, di = idx * 4;
        out[di] = image[si]; out[di + 1] = image[si + 1]; out[di + 2] = image[si + 2]; out[di + 3] = image[si + 3];
      } else if (dilatedMask[idx] >= 128) {
        const sx = clamp(nnfX[idx], 0, w - 1), sy = clamp(nnfY[idx], 0, h - 1);
        const si = (sy * w + sx) * 4, di = idx * 4;
        out[di] = Math.round(0.5 * image[di] + 0.5 * image[si]);
        out[di + 1] = Math.round(0.5 * image[di + 1] + 0.5 * image[si + 1]);
        out[di + 2] = Math.round(0.5 * image[di + 2] + 0.5 * image[si + 2]);
        out[di + 3] = image[di + 3];
      }
    }
  }
  return out;
}

export function runPatchMatch(
  image: Uint8ClampedArray, mask: Uint8ClampedArray,
  w: number, h: number, paramsIn?: Partial<PatchMatchParams>
): Uint8ClampedArray {
  const params: PatchMatchParams = { ...DEFAULT_PARAMS, ...paramsIn };
  if (countMaskPixels(mask) === 0) return new Uint8ClampedArray(image);

  const dilatedTop = dilateMask(mask, w, h, params.patchRadius);
  const pyramid = buildPyramid(image, dilatedTop, w, h, params.levels);

  let nnfX: Int32Array | null = null, nnfY: Int32Array | null = null;
  let prevW = 0, prevH = 0;

  for (let li = 0; li < pyramid.length; li++) {
    const lvl = pyramid[li];
    const nPix = lvl.w * lvl.h;
    // lvl.mask: 255=hole, 0=valid. Invert for our semantics.
    const valid = new Uint8ClampedArray(nPix);
    const hole = new Uint8Array(nPix);
    for (let i = 0; i < nPix; i++) {
      const isHole = lvl.mask[i] >= 128;
      hole[i] = isHole ? 1 : 0;
      valid[i] = isHole ? 0 : 255;
    }
    const err = new Float32Array(nPix);
    const rng = { s: (0x9e3779b9 ^ (lvl.w * 7919 + lvl.h)) | 1 };

    if (nnfX === null) {
      nnfX = new Int32Array(nPix); nnfY = new Int32Array(nPix);
      randomInit(nnfX, nnfY, err, lvl.image, computeGradients(lvl.image, lvl.w, lvl.h),
                 valid, lvl.w, lvl.h, hole, params.patchRadius, rng);
    } else {
      const up = upsampleNNF(nnfX!, nnfY!, prevW, prevH, lvl.w, lvl.h);
      nnfX = up.x; nnfY = up.y;
      for (let i = 0; i < nPix; i++) err[i] = Infinity;
    }
    runPatchMatchLevel(lvl.image, valid, hole, lvl.w, lvl.h, nnfX!, nnfY!, err, params, rng, params.iterations);
    prevW = lvl.w; prevH = lvl.h;
  }

  return fillAndBlend(image, nnfX!, nnfY!, mask, dilatedTop, w, h);
}
