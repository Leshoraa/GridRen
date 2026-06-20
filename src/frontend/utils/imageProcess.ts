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

  vibrance: number;
  whites: number;
  blacks: number;
  gamma: number;
  fade: number;

  texture: number;
  sharpeningRadius: number;
  denoiseDetail: number;
  defringe: number;

  halationIntensity: number;
  halationThreshold: number;
  halationRadius: number;
  mistIntensity: number;

  glitchSplit: number;
  glitchBlock: number;

  colorLeakIntensity: number;
  colorLeakHue: number;

  duoShadowHue: number;
  duoShadowSat: number;
  duoHighlightHue: number;
  duoHighlightSat: number;
  duoMix: number;

  sepia: number;
  solarize: number;
  posterize: number;
  thermal: number;
  crossProcess: number;

  vignetteFeather: number;
  vignetteRoundness: number;

  grainChroma: number;

  fisheye: number;
  distortion: number;

  borderWidth: number;
  borderHue: number;
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

export type PresetType = 'none' | 'mono' | 'matte' | 'brutalist' | 'cine' | 'vintage' | 'cyberpunk' | 'forest' | 'warmgold';

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

  const vib = adjustments.vibrance || 0;
  const white = adjustments.whites || 0;
  const black = adjustments.blacks || 0;
  const gam = adjustments.gamma !== undefined ? adjustments.gamma : 1;
  const fd = adjustments.fade || 0;
  const tex = adjustments.texture || 0;
  const shpRad = Math.round(adjustments.sharpeningRadius || 1);
  const denDetail = adjustments.denoiseDetail || 0;
  const defr = adjustments.defringe || 0;
  const halIntensity = adjustments.halationIntensity || 0;
  const halThresh = adjustments.halationThreshold || 0.8;
  const halRad = adjustments.halationRadius || 8;
  const mist = adjustments.mistIntensity || 0;
  const glSplit = Math.round(adjustments.glitchSplit || 0);
  const glBlock = Math.round(adjustments.glitchBlock || 0);
  const leakInt = adjustments.colorLeakIntensity || 0;
  const leakHue = adjustments.colorLeakHue !== undefined ? adjustments.colorLeakHue : 15;
  const duoM = adjustments.duoMix || 0;
  const duoSH = adjustments.duoShadowHue || 0;
  const duoSS = adjustments.duoShadowSat || 0;
  const duoHH = adjustments.duoHighlightHue || 0;
  const duoHS = adjustments.duoHighlightSat || 0;
  const sep = adjustments.sepia || 0;
  const sol = adjustments.solarize || 0;
  const post = adjustments.posterize || 0;
  const therm = adjustments.thermal || 0;
  const cp = adjustments.crossProcess || 0;
  const vigFeath = adjustments.vignetteFeather !== undefined ? adjustments.vignetteFeather : 0.5;
  const vigRound = adjustments.vignetteRoundness !== undefined ? adjustments.vignetteRoundness : 0.5;
  const grChroma = adjustments.grainChroma || 0;
  const fish = adjustments.fisheye || 0;
  const disto = adjustments.distortion || 0;
  const bWidth = adjustments.borderWidth || 0;
  const bHue = adjustments.borderHue !== undefined ? adjustments.borderHue : 0;

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

  let halationBuffer: Uint8ClampedArray | null = null;
  if (halIntensity > 0 && halRad > 0) {
    const extracted = extractHighlights(src, w, h, halThresh);
    halationBuffer = boxBlur(extracted, w, h, halRad);
  }

  let mistBuffer: Uint8ClampedArray | null = null;
  if (mist > 0) {
    mistBuffer = boxBlur(src, w, h, 20);
  }
  
  for (let i = 0; i < src.length; i += 4) {
    const xCo = (i / 4) % w;
    const yCo = Math.floor((i / 4) / w);

    let srcX = xCo;
    let srcY = yCo;

    if (fish !== 0 || disto !== 0) {
      const nx = (xCo - w / 2) / (w / 2);
      const ny = (yCo - h / 2) / (h / 2);
      const rSq = nx * nx + ny * ny;
      const theta = Math.atan2(ny, nx);
      let rNew = Math.sqrt(rSq);
      
      if (fish !== 0) {
        rNew = Math.sin(rNew * Math.PI / 2) * fish + rNew * (1 - fish);
      }
      if (disto !== 0) {
        rNew = rNew + disto * 0.2 * Math.pow(rNew, 3);
      }
      
      const newNx = rNew * Math.cos(theta);
      const newNy = rNew * Math.sin(theta);
      
      srcX = Math.round((newNx * w / 2) + w / 2);
      srcY = Math.round((newNy * h / 2) + h / 2);
      
      srcX = Math.max(0, Math.min(w - 1, srcX));
      srcY = Math.max(0, Math.min(h - 1, srcY));
    }

    const srcIdx = (srcY * w + srcX) * 4;
    let origR = src[srcIdx];
    let origG = src[srcIdx + 1];
    let origB = src[srcIdx + 2];
    const origA = src[srcIdx + 3];
    
    if (chromAb > 0) {
      const shift = Math.round(chromAb);
      const rX = Math.max(0, Math.min(w - 1, srcX - shift));
      const bX = Math.max(0, Math.min(w - 1, srcX + shift));
      origR = src[(srcY * w + rX) * 4];
      origB = src[(srcY * w + bX) * 4 + 2];
    }

    if (glSplit > 0) {
      const lineShift = Math.sin(srcY * 0.1) > 0.5 ? glSplit : Math.round(glSplit * 0.3);
      const rX = Math.max(0, Math.min(w - 1, srcX - lineShift));
      const bX = Math.max(0, Math.min(w - 1, srcX + lineShift));
      origR = src[(srcY * w + rX) * 4];
      origB = src[(srcY * w + bX) * 4 + 2];
    }

    if (glBlock > 0) {
      const blockSize = Math.max(1, Math.round(glBlock * 0.2));
      const blockX = Math.floor(srcX / blockSize) * blockSize;
      const blockY = Math.floor(srcY / blockSize) * blockSize;
      const blockIdx = (blockY * w + blockX) * 4;
      origR = src[blockIdx];
      origG = src[blockIdx + 1];
      origB = src[blockIdx + 2];
    }

    if (sharp > 0 || denoise > 0 || tex !== 0) {
      const lIdx = srcX >= shpRad ? srcIdx - 4 * shpRad : srcIdx;
      const rIdx = srcX < w - shpRad ? srcIdx + 4 * shpRad : srcIdx;
      const tIdx = srcY >= shpRad ? srcIdx - w * 4 * shpRad : srcIdx;
      const bIdx = srcY < h - shpRad ? srcIdx + w * 4 * shpRad : srcIdx;

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
        const localDiff = Math.abs(origR - avgR) + Math.abs(origG - avgG) + Math.abs(origB - avgB);
        const edgeFactor = Math.max(0, 1 - (localDiff / 100) * denDetail);
        origR = origR + denoise * edgeFactor * (avgR - origR);
        origG = origG + denoise * edgeFactor * (avgG - origG);
        origB = origB + denoise * edgeFactor * (avgB - origB);
      }

      if (tex !== 0) {
        const tRad = 2;
        const lIdx2 = srcX >= tRad ? srcIdx - 4 * tRad : srcIdx;
        const rIdx2 = srcX < w - tRad ? srcIdx + 4 * tRad : srcIdx;
        const tIdx2 = srcY >= tRad ? srcIdx - w * 4 * tRad : srcIdx;
        const bIdx2 = srcY < h - tRad ? srcIdx + w * 4 * tRad : srcIdx;

        const diffR = 4 * origR - src[lIdx2] - src[rIdx2] - src[tIdx2] - src[bIdx2];
        const diffG = 4 * origG - src[lIdx2 + 1] - src[rIdx2 + 1] - src[tIdx2 + 1] - src[bIdx2 + 1];
        const diffB = 4 * origB - src[lIdx2 + 2] - src[rIdx2 + 2] - src[tIdx2 + 2] - src[bIdx2 + 2];

        origR += tex * 0.5 * diffR;
        origG += tex * 0.5 * diffG;
        origB += tex * 0.5 * diffB;
      }
    }

    if (defr > 0) {
      const magentaFringe = Math.max(0, (origR + origB) / 2 - origG);
      if (magentaFringe > 15) {
        origR -= magentaFringe * defr * 0.8;
        origB -= magentaFringe * defr * 0.8;
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
      r = finalVal; g = finalVal; b = finalVal;
    } else if (preset === 'matte') {
      let lVal = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lVal = (lVal - 0.5) * 0.75 + 0.5;
      if (lVal < 0.2) lVal = lVal * 0.5 + 0.05;
      r = r * 0.3 + lVal * 255 * 0.7;
      g = g * 0.3 + lVal * 255 * 0.7;
      b = b * 0.3 + lVal * 255 * 0.7;
    } else if (preset === 'brutalist') {
      r = Math.min(255, Math.max(0, (r - 127) * 1.3 + 127 + 15));
      g = Math.min(255, Math.max(0, (g - 127) * 1.3 + 127));
      b = Math.min(255, Math.max(0, (b - 127) * 1.3 + 127 - 15));
    } else if (preset === 'cine') {
      r = Math.min(255, Math.max(0, (r - 127) * 1.25 + 127 + 10));
      g = Math.min(255, Math.max(0, (g - 127) * 1.15 + 127));
      b = Math.min(255, Math.max(0, (b - 127) * 1.1 + 127 - 10));
    } else if (preset === 'vintage') {
      r = r * 0.85 + 40;
      g = g * 0.8 + 30;
      b = b * 0.7 + 15;
    } else if (preset === 'cyberpunk') {
      const cvL = 0.299 * r + 0.587 * g + 0.114 * b;
      r = cvL * 0.8 + 60;
      g = cvL * 0.5;
      b = cvL * 0.9 + 50;
    } else if (preset === 'forest') {
      r = r * 0.6;
      g = g * 1.1;
      b = b * 0.8;
    } else if (preset === 'warmgold') {
      r = r * 1.1 + 20;
      g = g * 1.05 + 10;
      b = b * 0.9;
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

    if (vib !== 0) {
      const maxVal = Math.max(r, g, b) / 255;
      const minVal = Math.min(r, g, b) / 255;
      const amt = (maxVal - minVal) * (1.0 - maxVal);
      const factor = vib * amt * 3.0;
      r = r + (r - lVal) * factor;
      g = g + (g - lVal) * factor;
      b = b + (b - lVal) * factor;
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

    if (white !== 0) {
      const wWeight = Math.pow(Math.max(0, normL), 2);
      r += white * 40 * wWeight;
      g += white * 40 * wWeight;
      b += white * 40 * wWeight;
    }
    if (black !== 0) {
      const bWeight = Math.pow(Math.max(0, 1 - normL), 2);
      r += black * 40 * bWeight;
      g += black * 40 * bWeight;
      b += black * 40 * bWeight;
    }

    if (gam !== 1.0) {
      r = Math.pow(Math.max(0, r) / 255, 1.0 / gam) * 255;
      g = Math.pow(Math.max(0, g) / 255, 1.0 / gam) * 255;
      b = Math.pow(Math.max(0, b) / 255, 1.0 / gam) * 255;
    }
    if (fd > 0) {
      r = fd * 30 + r * (1 - fd * 0.2);
      g = fd * 30 + g * (1 - fd * 0.2);
      b = fd * 30 + b * (1 - fd * 0.2);
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

    if (duoM > 0) {
      const normL2 = Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
      const [sr, sg, sb] = hslToRgb(duoSH, duoSS, 0.2);
      const [hr, hg, hb] = hslToRgb(duoHH, duoHS, 0.8);
      const dr = sr * (1 - normL2) + hr * normL2;
      const dg = sg * (1 - normL2) + hg * normL2;
      const db = sb * (1 - normL2) + hb * normL2;
      r = r * (1 - duoM) + dr * duoM;
      g = g * (1 - duoM) + dg * duoM;
      b = b * (1 - duoM) + db * duoM;
    }

    if (sep > 0) {
      const sr = (r * 0.393 + g * 0.769 + b * 0.189);
      const sg = (r * 0.349 + g * 0.686 + b * 0.168);
      const sb = (r * 0.272 + g * 0.534 + b * 0.131);
      r = r * (1 - sep) + sr * sep;
      g = g * (1 - sep) + sg * sep;
      b = b * (1 - sep) + sb * sep;
    }

    if (sol > 0) {
      const curL = 0.299 * r + 0.587 * g + 0.114 * b;
      if (curL > sol * 255) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
    }

    if (post > 0 && post < 256) {
      const steps = Math.max(2, Math.round(post));
      r = Math.round(r / 255 * steps) / steps * 255;
      g = Math.round(g / 255 * steps) / steps * 255;
      b = Math.round(b / 255 * steps) / steps * 255;
    }

    if (therm > 0) {
      const curL = 0.299 * r + 0.587 * g + 0.114 * b;
      const nl = curL / 255;
      let tr = 0, tg = 0, tb = 0;
      if (nl < 0.33) {
        tb = (nl / 0.33) * 255;
      } else if (nl < 0.66) {
        tb = 255 - ((nl - 0.33) / 0.33) * 255;
        tr = ((nl - 0.33) / 0.33) * 255;
      } else {
        tr = 255;
        tg = ((nl - 0.66) / 0.34) * 255;
        tb = tg;
      }
      r = r * (1 - therm) + tr * therm;
      g = g * (1 - therm) + tg * therm;
      b = b * (1 - therm) + tb * therm;
    }

    if (cp > 0) {
      const cr = r > 128 ? r + (255 - r) * 0.2 : r * 0.8;
      const cg = g > 128 ? g + (255 - g) * 0.1 : g * 0.9;
      const cb = b > 128 ? b * 0.7 : b + (255 - b) * 0.3;
      r = r * (1 - cp) + cr * cp;
      g = g * (1 - cp) + cg * cp;
      b = b * (1 - cp) + cb * cp;
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

    if (halationBuffer) {
      r += halationBuffer[i] * halIntensity * 1.2;
      g += halationBuffer[i + 1] * halIntensity * 0.3;
      b += halationBuffer[i + 2] * halIntensity * 0.1;
    }

    if (mistBuffer) {
      r = r * (1 - mist * 0.25) + mistBuffer[i] * mist * 0.25;
      g = g * (1 - mist * 0.25) + mistBuffer[i + 1] * mist * 0.25;
      b = b * (1 - mist * 0.25) + mistBuffer[i + 2] * mist * 0.25;
    }
    
    if (vigInt > 0) {
      const dx = (xCo - w / 2) / (w / 2);
      const dy = ((yCo - h / 2) / (h / 2)) / (0.3 + vigRound * 0.7);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const innerLimit = 0.4 * (1 - vigFeath);
      const outerLimit = 1.2;
      let factor = 1;
      if (dist > innerLimit) {
        const t = Math.min(1, (dist - innerLimit) / (outerLimit - innerLimit));
        factor = 1 - t * vigInt;
      }
      r *= factor;
      g *= factor;
      b *= factor;
    }
    
    if (grainInt > 0) {
      const pR = Math.sin(Math.floor(xCo / grainSz) * 12.9898 + Math.floor(yCo / grainSz) * 78.233) * 43758.5453;
      const noiseR = ((pR - Math.floor(pR)) - 0.5) * grainInt * 255;
      
      const pG = Math.sin(Math.floor(xCo / grainSz) * 15.2341 + Math.floor(yCo / grainSz) * 43.193) * 31849.2841;
      const noiseG = ((pG - Math.floor(pG)) - 0.5) * grainInt * 255;
      
      const pB = Math.sin(Math.floor(xCo / grainSz) * 9.1837 + Math.floor(yCo / grainSz) * 112.87) * 58913.3982;
      const noiseB = ((pB - Math.floor(pB)) - 0.5) * grainInt * 255;
      
      r += noiseR;
      g += noiseR * (1 - grChroma) + noiseG * grChroma;
      b += noiseR * (1 - grChroma) + noiseB * grChroma;
    }

    if (leakInt > 0) {
      const leakPos = (w - xCo) / w;
      const leakWeight = Math.pow(leakPos, 2.5) * leakInt * 0.6;
      if (leakWeight > 0) {
        const [lr, lg, lb] = hslToRgb(leakHue, 1.0, 0.5);
        r = r * (1 - leakWeight) + lr * leakWeight;
        g = g * (1 - leakWeight) + lg * leakWeight;
        b = b * (1 - leakWeight) + lb * leakWeight;
      }
    }

    if (bWidth > 0) {
      const bSize = Math.round(Math.min(w, h) * bWidth);
      if (xCo < bSize || xCo >= w - bSize || yCo < bSize || yCo >= h - bSize) {
        const [br, bg, bb] = hslToRgb(bHue, 0.8, 0.9);
        r = br; g = bg; b = bb;
      }
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

export function applyInpaint(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  mask: Uint8ClampedArray
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  const maxIterations = 32;
  const currentMask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) {
    currentMask[i] = mask[i] > 128 ? 1 : 0;
  }
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (currentMask[idx] === 0) continue;
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        let count = 0;
        const neighbors = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 }
        ];
        for (const n of neighbors) {
          if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
            const nIdx = n.y * w + n.x;
            if (currentMask[nIdx] === 0) {
              const pIdx = nIdx * 4;
              rSum += result[pIdx];
              gSum += result[pIdx + 1];
              bSum += result[pIdx + 2];
              aSum += result[pIdx + 3];
              count++;
            }
          }
        }
        if (count > 0) {
          const pIdx = idx * 4;
          result[pIdx] = Math.round(rSum / count);
          result[pIdx + 1] = Math.round(gSum / count);
          result[pIdx + 2] = Math.round(bSum / count);
          result[pIdx + 3] = Math.round(aSum / count);
          currentMask[idx] = 0;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (let pass = 0; pass < 5; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (currentMask[idx] === 0) continue;
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        let count = 0;
        const neighbors = [
          { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 },
          { x: x - 1, y: y - 1 }, { x: x + 1, y: y - 1 }, { x: x - 1, y: y + 1 }, { x: x + 1, y: y + 1 }
        ];
        for (const n of neighbors) {
          if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
            const nIdx = n.y * w + n.x;
            if (currentMask[nIdx] === 0) {
              const pIdx = nIdx * 4;
              rSum += result[pIdx];
              gSum += result[pIdx + 1];
              bSum += result[pIdx + 2];
              aSum += result[pIdx + 3];
              count++;
            }
          }
        }
        if (count > 0) {
          const pIdx = idx * 4;
          result[pIdx] = Math.round(rSum / count);
          result[pIdx + 1] = Math.round(gSum / count);
          result[pIdx + 2] = Math.round(bSum / count);
          result[pIdx + 3] = Math.round(aSum / count);
          currentMask[idx] = 0;
        }
      }
    }
  }
  return result;
}
