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

  clarity: number;
  dehaze: number;
  sharpening: number;
  denoise: number;

  colorGradingBalance: number;
  colorGradingShadowsHue: number;
  colorGradingShadowsSat: number;
  colorGradingMidtonesHue: number;
  colorGradingMidtonesSat: number;
  colorGradingHighlightsHue: number;
  colorGradingHighlightsSat: number;

  hslHueRed: number;
  hslSatRed: number;
  hslLumRed: number;
  hslHueOrange: number;
  hslSatOrange: number;
  hslLumOrange: number;
  hslHueYellow: number;
  hslSatYellow: number;
  hslLumYellow: number;
  hslHueGreen: number;
  hslSatGreen: number;
  hslLumGreen: number;
  hslHueAqua: number;
  hslSatAqua: number;
  hslLumAqua: number;
  hslHueBlue: number;
  hslSatBlue: number;
  hslLumBlue: number;
  hslHuePurple: number;
  hslSatPurple: number;
  hslLumPurple: number;
  hslHueMagenta: number;
  hslSatMagenta: number;
  hslLumMagenta: number;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  let r = l;
  let g = l;
  let b = l;
  if (s !== 0) {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
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

  const sharp = adjustments.sharpening || 0;
  const denoise = adjustments.denoise || 0;
  const clarity = adjustments.clarity || 0;
  const dehaze = adjustments.dehaze || 0;

  let tintSR = 0, tintSG = 0, tintSB = 0;
  if (adjustments.colorGradingShadowsSat > 0) {
    const [tr, tg, tb] = hslToRgb(adjustments.colorGradingShadowsHue, adjustments.colorGradingShadowsSat, 0.5);
    tintSR = (tr - 128) * 0.4;
    tintSG = (tg - 128) * 0.4;
    tintSB = (tb - 128) * 0.4;
  }

  let tintMR = 0, tintMG = 0, tintMB = 0;
  if (adjustments.colorGradingMidtonesSat > 0) {
    const [tr, tg, tb] = hslToRgb(adjustments.colorGradingMidtonesHue, adjustments.colorGradingMidtonesSat, 0.5);
    tintMR = (tr - 128) * 0.4;
    tintMG = (tg - 128) * 0.4;
    tintMB = (tb - 128) * 0.4;
  }

  let tintHR = 0, tintHG = 0, tintHB = 0;
  if (adjustments.colorGradingHighlightsSat > 0) {
    const [tr, tg, tb] = hslToRgb(adjustments.colorGradingHighlightsHue, adjustments.colorGradingHighlightsSat, 0.5);
    tintHR = (tr - 128) * 0.4;
    tintHG = (tg - 128) * 0.4;
    tintHB = (tb - 128) * 0.4;
  }

  const centers = [0, 30, 60, 120, 180, 240, 285, 330, 360];
  const hShift = [
    adjustments.hslHueRed || 0, adjustments.hslHueOrange || 0, adjustments.hslHueYellow || 0, adjustments.hslHueGreen || 0,
    adjustments.hslHueAqua || 0, adjustments.hslHueBlue || 0, adjustments.hslHuePurple || 0, adjustments.hslHueMagenta || 0,
    adjustments.hslHueRed || 0
  ];
  const sShift = [
    adjustments.hslSatRed || 0, adjustments.hslSatOrange || 0, adjustments.hslSatYellow || 0, adjustments.hslSatGreen || 0,
    adjustments.hslSatAqua || 0, adjustments.hslSatBlue || 0, adjustments.hslSatPurple || 0, adjustments.hslSatMagenta || 0,
    adjustments.hslSatRed || 0
  ];
  const lShift = [
    adjustments.hslLumRed || 0, adjustments.hslLumOrange || 0, adjustments.hslLumYellow || 0, adjustments.hslLumGreen || 0,
    adjustments.hslLumAqua || 0, adjustments.hslLumBlue || 0, adjustments.hslLumPurple || 0, adjustments.hslLumMagenta || 0,
    adjustments.hslLumRed || 0
  ];

  const hasHsl = hShift.some(v => v !== 0) || sShift.some(v => v !== 0) || lShift.some(v => v !== 0);
  
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

    if (sharp > 0 || denoise > 0) {
      const lIdx = xCo > 0 ? i - 4 : i;
      const rIdx = xCo < w - 1 ? i + 4 : i;
      const tIdx = yCo > 0 ? i - w * 4 : i;
      const bIdx = yCo < h - 1 ? i + w * 4 : i;

      const lR = src[lIdx], lG = src[lIdx + 1], lB = src[lIdx + 2];
      const rR = src[rIdx], rG = src[rIdx + 1], rB = src[rIdx + 2];
      const tR = src[tIdx], tG = src[tIdx + 1], tB = src[tIdx + 2];
      const bR = src[bIdx], bG = src[bIdx + 1], bB = src[bIdx + 2];

      if (sharp > 0) {
        origR = origR + sharp * 0.4 * (4 * origR - lR - rR - tR - bR);
        origG = origG + sharp * 0.4 * (4 * origG - lG - rG - tG - bG);
        origB = origB + sharp * 0.4 * (4 * origB - lB - rB - tB - bB);
      }

      if (denoise > 0) {
        const avgR = (lR + rR + tR + bR + 4 * origR) / 8;
        const avgG = (lG + rG + tG + bG + 4 * origG) / 8;
        const avgB = (lB + rB + tB + bB + 4 * origB) / 8;
        origR = origR + denoise * (avgR - origR);
        origG = origG + denoise * (avgG - origG);
        origB = origB + denoise * (avgB - origB);
      }
    }

    if (dehaze !== 0) {
      origR = (origR - 127) * (1 + dehaze * 0.15) + 127 - dehaze * 10;
      origG = (origG - 127) * (1 + dehaze * 0.15) + 127 - dehaze * 10;
      origB = (origB - 127) * (1 + dehaze * 0.15) + 127 - dehaze * 10;
      const dhL = 0.299 * origR + 0.587 * origG + 0.114 * origB;
      origR = dhL + (origR - dhL) * (1 + dehaze * 0.2);
      origG = dhL + (origG - dhL) * (1 + dehaze * 0.2);
      origB = dhL + (origB - dhL) * (1 + dehaze * 0.2);
    }

    if (clarity !== 0) {
      const cL = (0.299 * origR + 0.587 * origG + 0.114 * origB) / 255;
      const wM = Math.sin(Math.PI * cL);
      const shift = (cL - 0.5) * clarity * 0.25 * wM * 255;
      origR += shift;
      origG += shift;
      origB += shift;
    }
    
    let r = origR;
    let g = origG;
    let b = origB;
    
    if (preset === 'mono') {
      const lVal = 0.299 * r + 0.587 * g + 0.114 * b;
      const cVal = (lVal / 255 - 0.5) * 1.6 + 0.5;
      const finalVal = Math.max(0, Math.min(255, Math.round(cVal * 255))) * 0.95;
      r = finalVal;
      g = finalVal;
      b = finalVal;
    } else if (preset === 'matte') {
      let lVal = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lVal = (lVal - 0.5) * 0.75 + 0.5;
      if (lVal < 0.2) {
        lVal = lVal * 0.5 + 0.05;
      }
      r = r * 0.3 + lVal * 255 * 0.7;
      g = g * 0.3 + lVal * 255 * 0.7;
      b = b * 0.3 + lVal * 255 * 0.7;
    } else if (preset === 'brutalist') {
      r = Math.min(255, Math.max(0, (r - 127) * 1.3 + 127 + 15));
      g = Math.min(255, Math.max(0, (g - 127) * 1.3 + 127));
      b = Math.min(255, Math.max(0, (b - 127) * 1.3 + 127 - 15));
    }
    
    if (expFactor !== 1) {
      r *= expFactor;
      g *= expFactor;
      b *= expFactor;
    }
    
    if (con !== 1) {
      r = Math.max(0, Math.min(255, ((r / 255 - 0.5) * con + 0.5) * 255));
      g = Math.max(0, Math.min(255, ((g / 255 - 0.5) * con + 0.5) * 255));
      b = Math.max(0, Math.min(255, ((b / 255 - 0.5) * con + 0.5) * 255));
    }
    
    let lVal = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat !== 1) {
      r = lVal + (r - lVal) * sat;
      g = lVal + (g - lVal) * sat;
      b = lVal + (b - lVal) * sat;
      lVal = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    
    const normL = lVal / 255;
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

    if (hasHsl) {
      const rN = r / 255;
      const gN = g / 255;
      const bN = b / 255;
      const max = rN > gN ? (rN > bN ? rN : bN) : (gN > bN ? gN : bN);
      const min = rN < gN ? (rN < bN ? rN : bN) : (gN < bN ? gN : bN);
      let hH = 0;
      let hS = 0;
      const hL = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        hS = hL > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rN) {
          hH = (gN - bN) / d + (gN < bN ? 6 : 0);
        } else if (max === gN) {
          hH = (bN - rN) / d + 2;
        } else {
          hH = (rN - gN) / d + 4;
        }
        hH *= 60;
      }

      let j = 0;
      while (j < 8 && hH > centers[j + 1]) {
        j++;
      }
      const t = (hH - centers[j]) / (centers[j + 1] - centers[j]);
      const hueShift = (1 - t) * hShift[j] + t * hShift[j + 1];
      const satMult = (1 - t) * sShift[j] + t * sShift[j + 1];
      const lumShift = (1 - t) * lShift[j] + t * lShift[j + 1];

      const newH = (hH + hueShift * 30 + 360) % 360;
      const newS = Math.max(0, Math.min(1, hS * (1 + satMult)));
      const newL = Math.max(0, Math.min(1, hL + lumShift * 0.4));

      const hS2 = newH / 360;
      let r2 = newL;
      let g2 = newL;
      let b2 = newL;
      if (newS !== 0) {
        const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
        const p = 2 * newL - q;
        
        let tR = hS2 + 1 / 3;
        if (tR < 0) tR += 1;
        if (tR > 1) tR -= 1;
        if (tR < 1 / 6) r2 = p + (q - p) * 6 * tR;
        else if (tR < 1 / 2) r2 = q;
        else if (tR < 2 / 3) r2 = p + (q - p) * (2 / 3 - tR) * 6;
        else r2 = p;

        let tG = hS2;
        if (tG < 0) tG += 1;
        if (tG > 1) tG -= 1;
        if (tG < 1 / 6) g2 = p + (q - p) * 6 * tG;
        else if (tG < 1 / 2) g2 = q;
        else if (tG < 2 / 3) g2 = p + (q - p) * (2 / 3 - tG) * 6;
        else g2 = p;

        let tB = hS2 - 1 / 3;
        if (tB < 0) tB += 1;
        if (tB > 1) tB -= 1;
        if (tB < 1 / 6) b2 = p + (q - p) * 6 * tB;
        else if (tB < 1 / 2) b2 = q;
        else if (tB < 2 / 3) b2 = p + (q - p) * (2 / 3 - tB) * 6;
        else b2 = p;
      }
      r = r2 * 255;
      g = g2 * 255;
      b = b2 * 255;
      lVal = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const bal = adjustments.colorGradingBalance || 0;
    const lBal = Math.max(0, Math.min(1, (lVal / 255) - bal * 0.25));
    const wS = Math.max(0, Math.min(1, 1 - lBal * 2));
    const wH = Math.max(0, Math.min(1, (lBal - 0.5) * 2));
    const wM = Math.max(0, Math.min(1, 1 - wS - wH));

    r += wS * tintSR + wM * tintMR + wH * tintHR;
    g += wS * tintSG + wM * tintMG + wH * tintHG;
    b += wS * tintSB + wM * tintMB + wH * tintHB;
    
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
