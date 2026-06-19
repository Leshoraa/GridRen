export interface AdjustmentState {
  exposure: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
  bloomThreshold: number;
  bloomIntensity: number;
  bloomRadius: number;
  bloomColor: [number, number, number] | null;
  temperature: number;
  tint: number;
  grainIntensity: number;
  grainSize: number;
  vignetteIntensity: number;
  chromaticAberration: number;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface CurvesState {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export type PresetType = 'none' | 'mono' | 'matte' | 'brutalist';

export function calculateSplineLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  
  if (sorted.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  
  if (sorted[0].x > 0) {
    sorted.unshift({ x: 0, y: sorted[0].y });
  }
  if (sorted[sorted.length - 1].x < 1) {
    sorted.push({ x: 1, y: sorted[sorted.length - 1].y });
  }
  
  const n = sorted.length;
  const x = sorted.map(p => p.x);
  const y = sorted.map(p => p.y);
  
  const h = new Array<number>(n - 1);
  const m = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    m[i] = (y[i + 1] - y[i]) / h[i];
  }
  
  const d = new Array<number>(n);
  d[0] = m[0];
  for (let i = 1; i < n - 1; i++) {
    d[i] = (m[i - 1] + m[i]) / 2;
  }
  d[n - 1] = m[n - 2];
  
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      d[i] = 0;
      d[i + 1] = 0;
    } else {
      const alpha = d[i] / m[i];
      const beta = d[i + 1] / m[i];
      const tau = Math.sqrt(alpha * alpha + beta * beta);
      if (tau > 3) {
        d[i] = (3 / tau) * alpha * m[i];
        d[i + 1] = (3 / tau) * beta * m[i];
      }
    }
  }
  
  for (let i = 0; i < 256; i++) {
    const val = i / 255;
    let idx = 0;
    while (idx < n - 2 && val > x[idx + 1]) {
      idx++;
    }
    
    const xL = x[idx];
    const xR = x[idx + 1];
    const hL = h[idx];
    const t = (val - xL) / hL;
    
    const yL = y[idx];
    const yR = y[idx + 1];
    const dL = d[idx];
    const dR = d[idx + 1];
    
    const interp = (2 * t * t * t - 3 * t * t + 1) * yL +
                   (t * t * t - 2 * t * t + t) * hL * dL +
                   (-2 * t * t * t + 3 * t * t) * yR +
                   (t * t * t - t * t) * hL * dR;
                   
    lut[i] = Math.max(0, Math.min(255, Math.round(interp * 255)));
  }
  
  return lut;
}

export function boxBlur(
  src: Uint8ClampedArray<any>,
  w: number,
  h: number,
  r: number
): Uint8ClampedArray<any> {
  const dest = new Uint8ClampedArray(src.length);
  const size = w * h;
  
  for (let c = 0; c < 3; c++) {
    let temp = new Uint8ClampedArray(size);
    for (let i = 0; i < size; i++) {
      temp[i] = src[i * 4 + c];
    }
    
    let temp2 = new Uint8ClampedArray(size);
    boxBlurH(temp, temp2, w, h, r);
    boxBlurT(temp2, temp, w, h, r);
    boxBlurH(temp, temp2, w, h, r);
    
    for (let i = 0; i < size; i++) {
      dest[i * 4 + c] = temp2[i];
    }
  }
  
  for (let i = 0; i < size; i++) {
    dest[i * 4 + 3] = src[i * 4 + 3];
  }
  
  return dest;
}

function boxBlurH(
  s: Uint8ClampedArray<any>,
  d: Uint8ClampedArray<any>,
  w: number,
  h: number,
  r: number
) {
  const arr = 1 / (r + r + 1);
  for (let i = 0; i < h; i++) {
    let ti = i * w;
    let li = ti;
    let ri = ti + r;
    let fv = s[ti];
    let lv = s[ti + w - 1];
    let val = (r + 1) * fv;
    
    for (let j = 0; j < r; j++) {
      val += s[ti + j];
    }
    
    for (let j = 0; j <= r; j++) {
      val += s[ri++] - fv;
      d[ti++] = val * arr;
    }
    
    for (let j = r + 1; j < w - r; j++) {
      val += s[ri++] - s[li++];
      d[ti++] = val * arr;
    }
    
    for (let j = w - r; j < w; j++) {
      val += lv - s[li++];
      d[ti++] = val * arr;
    }
  }
}

function boxBlurT(
  s: Uint8ClampedArray<any>,
  d: Uint8ClampedArray<any>,
  w: number,
  h: number,
  r: number
) {
  const arr = 1 / (r + r + 1);
  for (let i = 0; i < w; i++) {
    let ti = i;
    let li = ti;
    let ri = ti + r * w;
    let fv = s[ti];
    let lv = s[ti + (h - 1) * w];
    let val = (r + 1) * fv;
    
    for (let j = 0; j < r; j++) {
      val += s[ti + j * w];
    }
    
    for (let j = 0; j <= r; j++) {
      val += s[ri] - fv;
      d[ti] = val * arr;
      ri += w;
      ti += w;
    }
    
    for (let j = r + 1; j < h - r; j++) {
      val += s[ri] - s[li];
      d[ti] = val * arr;
      li += w;
      ri += w;
      ti += w;
    }
    
    for (let j = h - r; j < h; j++) {
      val += lv - s[li];
      d[ti] = val * arr;
      li += w;
      ti += w;
    }
  }
}

export function extractHighlights(
  src: Uint8ClampedArray<any>,
  w: number,
  h: number,
  threshold: number
): Uint8ClampedArray<any> {
  const dest = new Uint8ClampedArray(src.length);
  const limit = threshold * 255;
  
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    
    if (l > limit) {
      dest[i] = r;
      dest[i + 1] = g;
      dest[i + 2] = b;
    } else {
      dest[i] = 0;
      dest[i + 1] = 0;
      dest[i + 2] = 0;
    }
    dest[i + 3] = src[i + 3];
  }
  
  return dest;
}

export function processPixels(
  src: Uint8ClampedArray<any>,
  w: number,
  h: number,
  adjustments: AdjustmentState,
  curves: CurvesState,
  preset: PresetType,
  mask: Uint8ClampedArray<any> | null
): Uint8ClampedArray<any> {
  const dest = new Uint8ClampedArray(src.length);
  
  const lutRGB = calculateSplineLUT(curves.rgb);
  const lutR = calculateSplineLUT(curves.red);
  const lutG = calculateSplineLUT(curves.green);
  const lutB = calculateSplineLUT(curves.blue);
  
  const expFactor = Math.pow(2, adjustments.exposure);
  const con = adjustments.contrast;
  const sat = adjustments.saturation;
  const high = adjustments.highlights;
  const shad = adjustments.shadows;
  
  const temp = adjustments.temperature || 0;
  const tintVal = adjustments.tint || 0;
  const grainInt = adjustments.grainIntensity || 0;
  const grainSz = adjustments.grainSize || 1;
  const vigInt = adjustments.vignetteIntensity || 0;
  const chromAb = adjustments.chromaticAberration || 0;
  
  let bloomBuffer: Uint8ClampedArray | null = null;
  if (adjustments.bloomIntensity > 0 && adjustments.bloomRadius > 0) {
    const extracted = extractHighlights(src, w, h, adjustments.bloomThreshold);
    bloomBuffer = boxBlur(extracted, w, h, adjustments.bloomRadius);
  }
  
  for (let i = 0; i < src.length; i += 4) {
    const xCo = (i / 4) % w;
    const yCo = Math.floor((i / 4) / w);
    
    let origR = src[i];
    let origG = src[i + 1];
    let origB = src[i + 2];
    const origA = src[i + 3];
    
    if (chromAb > 0) {
      const shift = Math.round(chromAb);
      const rX = Math.max(0, Math.min(w - 1, xCo - shift));
      const bX = Math.max(0, Math.min(w - 1, xCo + shift));
      origR = src[(yCo * w + rX) * 4];
      origB = src[(yCo * w + bX) * 4 + 2];
    }
    
    let r = origR;
    let g = origG;
    let b = origB;
    
    if (preset === 'mono') {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const c = (l / 255 - 0.5) * 1.6 + 0.5;
      const finalVal = Math.max(0, Math.min(255, Math.round(c * 255))) * 0.95;
      r = finalVal;
      g = finalVal;
      b = finalVal;
    } else if (preset === 'matte') {
      let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      l = (l - 0.5) * 0.75 + 0.5;
      if (l < 0.2) {
        l = l * 0.5 + 0.05;
      }
      r = r * 0.3 + l * 255 * 0.7;
      g = g * 0.3 + l * 255 * 0.7;
      b = b * 0.3 + l * 255 * 0.7;
    } else if (preset === 'brutalist') {
      r = Math.min(255, Math.max(0, (r - 127) * 1.3 + 127 + 15));
      g = Math.min(255, Math.max(0, (g - 127) * 1.3 + 127));
      b = Math.min(255, Math.max(0, (b - 127) * 1.3 + 127 - 15));
    }
    
    r = r * expFactor;
    g = g * expFactor;
    b = b * expFactor;
    
    r = (r / 255 - 0.5) * con + 0.5;
    g = (g / 255 - 0.5) * con + 0.5;
    b = (b / 255 - 0.5) * con + 0.5;
    r = Math.max(0, Math.min(1, r)) * 255;
    g = Math.max(0, Math.min(1, g)) * 255;
    b = Math.max(0, Math.min(1, b)) * 255;
    
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    
    const normL = l / 255;
    if (high !== 0) {
      const wH = Math.pow(Math.max(0, Math.min(1, (normL - 0.5) * 2)), 2);
      r += r * high * 0.5 * wH;
      g += g * high * 0.5 * wH;
      b += b * high * 0.5 * wH;
    }
    if (shad !== 0) {
      const wS = Math.pow(Math.max(0, Math.min(1, (0.5 - normL) * 2)), 2);
      r += r * shad * 0.5 * wS;
      g += g * shad * 0.5 * wS;
      b += b * shad * 0.5 * wS;
    }
    
    r = lutRGB[Math.max(0, Math.min(255, Math.round(r)))];
    g = lutRGB[Math.max(0, Math.min(255, Math.round(g)))];
    b = lutRGB[Math.max(0, Math.min(255, Math.round(b)))];
    
    r = lutR[r];
    g = lutG[g];
    b = lutB[b];
    
    if (temp !== 0) {
      r += temp * 25;
      b -= temp * 25;
    }
    if (tintVal !== 0) {
      g += tintVal * 20;
      r -= tintVal * 10;
      b -= tintVal * 10;
    }
    
    if (bloomBuffer) {
      const br = bloomBuffer[i];
      const bg = bloomBuffer[i + 1];
      const bb = bloomBuffer[i + 2];
      
      if (adjustments.bloomColor) {
        const [tr, tg, tb] = adjustments.bloomColor;
        const tintWeight = 0.7;
        
        const bL = 0.299 * br + 0.587 * bg + 0.114 * bb;
        const trVal = bL * (tr / 255) * tintWeight + br * (1 - tintWeight);
        const tgVal = bL * (tg / 255) * tintWeight + bg * (1 - tintWeight);
        const tbVal = bL * (tb / 255) * tintWeight + bb * (1 - tintWeight);
        
        r += trVal * adjustments.bloomIntensity;
        g += tgVal * adjustments.bloomIntensity;
        b += tbVal * adjustments.bloomIntensity;
      } else {
        r += br * adjustments.bloomIntensity;
        g += bg * adjustments.bloomIntensity;
        b += bb * adjustments.bloomIntensity;
      }
    }
    
    if (vigInt > 0) {
      const dx = (xCo - w / 2) / (w / 2);
      const dy = (yCo - h / 2) / (h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vignetteFactor = 1 - vigInt * Math.min(1, Math.pow(dist, 2));
      r *= vignetteFactor;
      g *= vignetteFactor;
      b *= vignetteFactor;
    }
    
    if (grainInt > 0) {
      const pseudoRand = Math.sin(Math.floor(xCo / grainSz) * 12.9898 + Math.floor(yCo / grainSz) * 78.233) * 43758.5453;
      const noise = ((pseudoRand - Math.floor(pseudoRand)) - 0.5) * grainInt * 255;
      r += noise;
      g += noise;
      b += noise;
    }
    
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    
    if (mask) {
      const mWeight = mask[i / 4] / 255;
      dest[i] = Math.round((1 - mWeight) * origR + mWeight * r);
      dest[i + 1] = Math.round((1 - mWeight) * origG + mWeight * g);
      dest[i + 2] = Math.round((1 - mWeight) * origB + mWeight * b);
      dest[i + 3] = origA;
    } else {
      dest[i] = r;
      dest[i + 1] = g;
      dest[i + 2] = b;
      dest[i + 3] = origA;
    }
  }
  
  return dest;
}
