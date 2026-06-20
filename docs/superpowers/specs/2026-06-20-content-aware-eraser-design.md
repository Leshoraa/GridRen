# Content-Aware Eraser — PatchMatch Inpainting

**Tanggal:** 2026-06-20
**Status:** Draft, menunggu review
**Scope:** Menghapus jalur AI (OpenRouter) pada Object Eraser, mengganti algoritma inpaint lokal dengan PatchMatch (content-aware) + OpenCV TELEA (tier cepat).

## Latar Belakang & Motivasi

Object Eraser saat ini punya dua engine:

1. **Local (OpenCV.js)** — algoritma `cv.inpaint` dengan metode **TELEA**. TELEA adalah algoritma *diffusion-based*: ia hanya mempropagasi warna dari border hole secara radial (fast marching). Hasilnya seperti "digosok"/smear/streaking, terutama untuk region besar, karena **algoritma tidak pernah melihat konten gambar lain** di luar border.
2. **Cloud AI (OpenRouter)** — mengirim gambar+mask ke model generatif (mis. Gemini). Hasil bagus tapi bergantung API key eksternal, network, biaya, privasi.

**Tujuan user:** eraser lokal yang "membaca keseluruhan foto, memperkirakan background dari objek yang dihapus" sehingga hasil rapi. Ini adalah paradigma *exemplar-based / patch-based* — algoritma di balik **Photoshop Content-Aware Fill** (PatchMatch, Barnes et al. 2009).

**Keputusan:** hapus AI sepenuhnya; pertahankan OpenCV.js untuk tier cepat; tambah PatchMatch pure-TypeScript untuk region sedang/besar; berjalan di Web Worker terpisah.

## Persyaratan

### Fungsional
- Hapus seluruh jalur OpenRouter/AI: file route, proxy backend, UI engine selector, API key input, model picker.
- Object Eraser menghasilkan fill yang "memperkirakan background" dengan mencari patch terbaik dari seluruh area gambar yang valid, bukan hanya border.
- Bekerja untuk semua ukuran region: blemish kecil hingga objek besar (>20% area).
- Hasil: rapi, tanpa smear/streaking yang khas TELEA pada region besar.

### Non-fungsional
- **Performa:** preview cepat (tidak ada komputasi saat brush dragging), final async via worker (~1-3 detik untuk region besar pada preview res ≤900px). Editor tetap responsif selama komputasi (worker terpisah).
- **Ketergantungan:** OpenCV.js tetap (sudah dimuat, dipakai tier cepat + dilasi mask). Tidak menambah dependency baru. Tidak menambah framework testing.
- **Kompabilitas:** tidak mengganggu pipeline editing lain (adjustments, masks, export).
- **UX:** pakai overlay spinner yang sudah ada ("Removing Object..."). Tidak menambah progress bar dulu.

## Arsitektur

### Perubahan file

```
src/
├── routes/inpaint.ts               → HAPUS seluruhnya
├── routes/index.ts                 → Hapus import & .use(inpaintRoutes)
├── frontend/
│   ├── utils/
│   │   ├── imageProcess.ts         → - Hapus applyOpenRouterInpaint()
│   │   │                              - Hapus refineMaskWithGrabCut() dan panggilannya
│   │   │                                di dalam applyInpaint() (GrabCut overkill untuk
│   │   │                                region kecil & memperlambat; PatchMatch tangani region besar)
│   │   │                              - Pertahankan applyInpaint() sebagai tier cepat
│   │   │                                (cv.inpaint TELEA murni, tanpa GrabCut)
│   │   │                              + Tambah applyPatchMatch() = thin async wrapper ke worker
│   │   │                              + Tambah helper countMaskPixels()
│   │   └── patchMatchWorker.ts     → [BARU] Web Worker terpisah untuk PatchMatch
│   │                                 (inline source string + blob, pola sama imageProcessWorker)
│   ├── components/EraserModule.tsx → Hapus engine selector, API key, model picker, state terkait.
│   │                                 Pertahankan brush slider, paint select/erase, tombol Erase/Clear.
│   │                                 Update info text & label tombol.
│   └── App.tsx                     → Hapus state eraserEngine/openrouterApiKey/openrouterModel +
│                                     localStorage effects. Sederhanakan handleApplyErase().
```

### File BARU: `src/frontend/utils/patchMatchWorker.ts`

Worker terpisah dari `imageProcessWorker.ts`. **Alasan:** PatchMatch berjalan 1-3 detik. Berbagi worker dengan pipeline adjustment akan membekukan slider selama erase berjalan. Worker terpisah menjaga editor responsif.

**Pola implementasi (sama dengan imageProcessWorker.ts):**
- Source PatchMatch sebagai **inline string template literal** (karena worker via Blob URL tidak bisa import modul TS tanpa bundler; konsistensi pola yang sudah ada).
- Single shared `Worker` instance via `getWorker()`.
- Generational job ID untuk cancellation: `currentGeneration` di-increment tiap request; response dengan `id < currentGeneration - 1` di-resolve `null` (stale).
- `pending: Map<id, {resolve}>` untuk callback.
- `worker.onerror` → resolve null untuk semua pending.

**Message protocol:**
```ts
// Request (main → worker)
type PatchMatchRequest = {
  id: number;
  type: 'patchmatch';
  image: Uint8ClampedArray;   // w*h*4 RGBA
  mask: Uint8ClampedArray;    // w*h, 0/255 (255=hole)
  w: number; h: number;
  params?: Partial<PatchMatchParams>;
};

// Response (worker → main)
type PatchMatchResponse = {
  id: number; type: 'patchmatch';
  result: Uint8ClampedArray;  // w*h*4, full image dengan hole terisi
};

interface PatchMatchParams {
  patchRadius: number;    // default 4 → patch 9×9
  iterations: number;     // default 5 per level
  levels: number;         // default = max(1, floor(log2(maxDim/128)))
  searchAlpha: number;    // default 0.5 (penurunan eksponensial random search)
}
```

**Transferable buffers:** `[image.buffer, mask.buffer, result.buffer]` (zero-copy). Image & mask dikopi di main thread sebelum post (tidak mengubah buffer asli).

### API publik di `imageProcess.ts`

```ts
// Sinkron, tier cepat (region kecil) — sudah ada, dipertahankan
export function applyInpaint(
  pixels: Uint8ClampedArray, w: number, h: number, mask: Uint8ClampedArray
): Uint8ClampedArray;

// [BARU] Async, tier region sedang/besar — wrapper ke worker
export async function applyPatchMatch(
  pixels: Uint8ClampedArray, w: number, h: number, mask: Uint8ClampedArray,
  params?: Partial<PatchMatchParams>
): Promise<Uint8ClampedArray>;

// [BARU] helper kecil
export function countMaskPixels(mask: Uint8ClampedArray): number;
```

## Algoritma PatchMatch (inti matematika)

### Input/Output
- **Input:** `image` (RGBA, w×h×4), `mask` (grayscale, w×h, 255=hole/0=valid).
- **Output:** `image` dengan setiap piksel hole terisi dari lokasi sumber terbaik.

### Konsep
Setiap piksel hole `p` dicarikan **offset** `(dx,dy)` sehingga patch berukuran `(2r+1)²` di sekitar `p` cocok (SSD minimal) dengan patch pada lokasi sumber `q = p + (dx,dy)` yang berada di area valid. Hasil: `image[p] ← image[q]`. Offset-offset ini disimpan dalam **Nearest Neighbor Field (NNF)** — "peta" dari mana tiap piksel hole berasal.

### Struktur data
- `nnfX: Int32Array(w*h)`, `nnfY: Int32Array(w*h)` — offset per piksel.
- `nnfError: Float32Array(w*h)` — SSD saat ini per piksel (untuk optimasi, skip recompute).
- `valid: Uint8Array(w*h)` — 1 jika piksel valid (bukan hole) di mask terdilasi.

### Tahap 1 — Mask preprocessing
1. **Dilasi** mask sebanyak `patchRadius` piksel. Memastikan patch hole overlap dengan border valid agar matching punya konteks. Implementasi: box-filter threshold (rata-rata 3×3 > 0 → 255) diulang `patchRadius` kali, atau `cv.dilate` OpenCV (sudah ada). Pilihan: pakai box-filter murni TS di worker (worker tidak akses OpenCV), tidak import OpenCV ke worker.
2. **Bounding box** hole → region of interest (ROI) + padding `patchRadius*2`. Hanya proses ROI, bukan seluruh gambar → optimasi besar.
3. Build LUT `valid[]`.

### Tahap 2 — PatchMatch core (per level)

```
build NNF kosong untuk level
if level == coarse:
  randomInit(nnf)         # offset acak tiap hole → lokasi valid
else:
  upsample(nnf dari level lebih coarse, ×2)

for iter in 0..iterations-1:
  reverse = (iter % 2 == 1)
  order = reverse ? bottom→top,right→left : top→bottom,left→right
  for p in hole (hanya piksel hole, dalam order):
    # PROPAGATION: coba offset dari tetangga yang sudah diupdate iterasi ini
    candidates = []
    for n in {tetangga kiri/atas OR kanan/bawah sesuai arah}:
      if neighbor is hole: candidates.push(nnf[n])
    # RANDOM SEARCH: spiral eksponensial di sekitar best saat ini
    candidates += randomSearch(p, bestOffset, w_search)
    # pilih kandidat terbaik
    best = argmin over candidates of patchDistance(p, p+offset)
    nnf[p] = best; nnfError[p] = dist(best)
```

**PatchDistance(p, q)** — Sum of Squared Differences atas patch `(2r+1)²`, hanya piksel sumber `q+(i,j)` yang valid:
```
D(p,q) = Σ_{(i,j) ∈ patch} valid[q+(i,j)] ? (image[p+(i,j)] - image[q+(i,j)])² : PENALTY
```
- **Clamp koordinat** ke border gambar (bukan skip) → tetap vektor.
- **Early termination:** akumulasi SSD; jika melebihi `bestSoFar + 1`, hentikan awal → hemat ~50-80% operasi.
- Normalisasi: dibagi jumlah piksel valid yang dibandingkan (untuk fair antar kandidat).

**RandomSearch(p, offset, w_search)** — Barnes 2009:
```
radius = w_search            # = min(w,h) level ini
while radius >= 1:
  q = offset + random(-radius, +radius) per axis
  if valid(q): evaluate, update best
  radius *= searchAlpha       # 0.5 → menurun eksponensial
```

### Tahap 3 — Multi-scale (coarse-to-fine)

Piramiada Gaussian sederhana (atau box-average 2×2 downsample):
```
build pyramid: level 0 = full, level k = half(resolusi level k-1)
hingga maxDim(level terbesar) ≈ 64-128

for level from coarse → fine:
  (init/upsample NNF seperti Tahap 2)
  run PatchMatch iterations pada level ini
upsample NNF final ke full res; run 1-2 iter final untuk crispness
```

**Mengapa ini bekerja:** di level coarse, struktur besar (rumput/langit/dinding) tertangkap dengan offset besar secara cepat. Saat naik ke level fine, offset di-refine secara lokal. Multi-scale mencegah local minima dan mempercepat konvergensi — inilah yang membuat algoritma "melihat keseluruhan foto".

### Tahap 4 — Structure-aware term

Tambah arah isophote ke distance: hitung gradient (Sobel) magnitude+angle per piksel. Pada patchDistance, tambahkan term perbedaan gradient angle antar piksel pasangan. Mencegah garis/tepi yang menembus objek menjadi patah. Overhead kecil, hasil lebih koheren untuk struktur.

**Implementasi ringan:** hitung `gradX`, `gradY` (Sobel) sekali per level. Pada SSD, boboti perbedaan gradient dengan faktor kecil (mis. 0.3×) selain perbedaan RGB.

### Tahap 5 — Fill & Blend
- **Fill:** `result[p] = image[clamp(p + nnf[p])]` untuk setiap `p` di hole.
- **Seam blend (feather linear):** di zona dilasi (lebar `patchRadius`), lerp antara hasil inpaint dan asli dengan alpha = maskDilated/255. Cepat, hasil cukup baik. Tidak pakai Poisson (lebih berat, YAGNI).

### Parameter default
| Parameter | Nilai | Catatan |
|---|---|---|
| `patchRadius` | 4 | patch 9×9; balance akurasi vs kecepatan |
| `iterations` | 5 | per level; konvergen cepat berkat propagasi |
| `levels` | `max(1, floor(log2(maxDim/128)))` | biasanya 3-4 untuk maxDim 900 |
| `searchAlpha` | 0.5 | penurunan eksponensial random search |

### Kompleksitas
`O(iterations × |hole| × patchSize × searchSamples)` per level. Multi-scale menurunkan konstanta secara signifikan (hole di level coarse lebih kecil). Praktis ~1-3 detik untuk region ~30% pada 900px di worker.

## Tiering Strategy

```ts
const SMALL_THRESHOLD = 0.02;  // 2% area
const holeRatio = countMaskPixels(eraserBuffer) / (previewW * previewH);

if (holeRatio < SMALL_THRESHOLD) {
  applyInpaint(OpenCV TELEA);   // sync, cepat, tepat untuk blemish/garis tipis
} else {
  await applyPatchMatch();       // async worker, content-aware
}
```

**Justifikasi tiering:** TELEA sangat baik & cepat untuk region kecil (blemish, spot, garis tipis) — smear tidak terlihat. PatchMatch berlebihan & lambat untuk region <2%. Sebaliknya, untuk region besar PatchMatch jauh lebih baik.

## Integrasi UI

### `EraserModule.tsx` — disederhanakan
**Hapus:**
- Dropdown "Inpainting Engine" + state `eraserEngine`
- Blok OpenRouter: API key input, model slug, search, dropdown model, state `models/searchTerm/isOpen/isLoading`
- `useEffect` fetch `/api/v1/inpaint/models`
- Filtered models logic
- Props: `eraserEngine`, `setEraserEngine`, `openrouterApiKey`, `setOpenrouterApiKey`, `openrouterModel`, `setOpenrouterModel`

**Pertahankan:**
- Brush Size / Feather / Opacity slider (SwissSlider)
- Paint Select / Paint Erase toggle
- Tombol "Erase Object" — disabled saat `!hasMaskPixels || !isCvReady`
- Tombol "Clear Selection"

**Info text baru:**
> "Brush over unwanted objects. The eraser analyzes the entire photo to reconstruct background — may take a few seconds for large selections."

### `App.tsx` — perubahan state & handler
**Hapus state + localStorage:**
- `eraserEngine`, `openrouterApiKey`, `openrouterModel` (+ 3 useEffect localStorage)

**Hapus import:** `applyOpenRouterInpaint`

**`handleApplyErase()` baru:**
```ts
const handleApplyErase = async () => {
  const orig = canvasRef.current?.getOrigPixels();
  if (!orig || !eraserBuffer || !previewW || !previewH) return;
  if (!hasEraserPixels) { showToast('Please paint on the image first'); return; }
  if (!isCvReady) { showToast('OpenCV.js is loading, please wait...'); return; }
  setIsProcessing(true);
  try {
    const holeRatio = countMaskPixels(eraserBuffer) / (previewW * previewH);
    let nextPixels: Uint8ClampedArray;
    if (holeRatio < 0.02) {
      nextPixels = applyInpaint(orig, previewW, previewH, eraserBuffer); // OpenCV sync
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
    showToast(err instanceof Error ? err.message : 'Failed to erase object');
  } finally {
    setIsProcessing(false);
  }
};
```

### Backend cleanup
- **Hapus** `src/routes/inpaint.ts` seluruhnya.
- **`src/routes/index.ts`:** hapus `import { inpaintRoutes }` dan `.use(inpaintRoutes)`.

## Error Handling & Edge Cases

| Kasus | Penanganan |
|---|---|
| Mask kosong | Guard `hasEraserPixels` sudah ada; toast "Please paint on the image first" |
| Hole ≈100% gambar (tidak ada sumber valid) | PatchMatch pada level paling coarse saja; jika benar-benar tidak ada valid pixel, fill rata-rata warna border. Kasus jarang, cukup tidak crash. |
| Mask tipis 1px / garis sempit | `holeRatio < 0.02` → tier ke OpenCV TELEA (tepat untuk garis) |
| Worker crash / OOM | `worker.onerror` resolve null → App.tsx catch → **fallback sinkron ke OpenCV TELEA** + toast "Content-aware failed, used fast mode" |
| Cancel mid-process | Generational ID; response stale di-drop |
| Gambar >900px | PatchMatch jalan di preview res (≤900px sesuai arsitektur preview); export hi-res tidak re-run PatchMatch (hole sudah terisi di origPixels) |

## Testing

Proyek tidak punya framework test (`package.json` test = error). **Tidak menambah** framework (out of scope, YAGNI).

Strategi: PatchMatch sebagai fungsi murni modular (`buildNNF`, `patchDistance`, `randomSearch`, `propagate`, `buildPyramid`) sehingga mudah di-test unit nanti. Verifikasi manual via dev server:
- Blemish kecil → tier OpenCV, cepat, rapi.
- Objek sedang (orang di rumput) → PatchMatch, fill rumput koheren.
- Objek besar (>20%) → PatchMatch multi-scale, tidak smear.
- Cancel selama proses → tidak crash.
- Edge case: gambar tanpa area valid besar.

## Out of Scope (YAGNI)
- Progress bar selama PatchMatch (pakai spinner existing).
- Poisson blending (feather linear cukup).
- WebGL/WASM acceleration (pure TS di worker sudah memadai).
- Framework testing otomatis.
- Re-run PatchMatch saat export hi-res (hole sudah terisi di origPixels preview).
- PatchMatch pada mask adjustment brush (hanya untuk Eraser tab).
