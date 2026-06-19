# GridRen

GridRen is a high-performance, Swiss-design engineered photo editor featuring direct canvas rendering, advanced parametric adjustments, and local masking controls.

## Key Features

* **Direct Canvas Pixel Processing**: Real-time pixel manipulations performed client-side using customized algorithms for exposure, contrast, saturation, shadows, highlights, and threshold-based bloom.
* **Local Adjustment Masking**:
  * **Brush Tool**: Add or erase adjustments with adjustable brush size, hardness (feather), and opacity.
  * **Radial Gradient Mask**: Linear-falloff radial gradients for localized vignette or spot edits.
  * **Linear Gradient Mask**: Angle-aware linear gradient mask sweeps.
  * *Each mask maintains its own independent adjustment sliders and parametric curve sets.*
* **Parametric Tone Curves**: Individual curves for RGB composite, Red, Green, and Blue channels.
* **Interactive Canvas Workspace**:
  * **Zoom controls**: Dynamic zoom levels from 25% to 200% with smooth center-origin scaling.
  * **Zero-lag Panning**: Interactive view panning utilizing `Spacebar + Left Click Drag`, `Middle Click Drag`, or default click-drag when no mask tool is selected.
  * **Smart Reset**: Clean, conditional Reset Position button appearing in the header zoom bar when coordinates are offset.
* **Robust History Management**: Stack-based Undo and Redo states tracking global adjustments, curves, and masking layers.
* **High-Resolution Export**: High-resolution image compiler scaling local masks and rendering parameters back to native resolution for download.
* **Premium Minimalist UI**: Swiss-inspired high-contrast aesthetics with seamless dark/light theme switching and collapsable side panel.

## Control Shortcuts

| Action | Control |
| :--- | :--- |
| **Pan Workspace** | Hold `Spacebar` + Drag Left Click |
| **Pan Workspace (Alternative)** | Hold `Middle Mouse Button` + Drag |
| **Default Pan** | Drag Left Click (when active mask tool is set to none) |
| **Undo** | Click Undo Button / Global History Control |
| **Redo** | Click Redo Button / Global History Control |

## Technology Stack

* **Runtime**: Bun
* **Backend Framework**: Elysia
* **Frontend**: React 19, TypeScript
* **Icons**: Lucide React
* **Styling**: Vanilla CSS (Swiss modernist design system)

## Getting Started

### Installation

Install dependencies:
```bash
bun install
```

### Run Development Server

To launch the Elysia server with automatic hot-reloading:
```bash
bun run dev
```
Open `http://localhost:3000` in your web browser.

### Compile Production Assets

To compile and bundle the React frontend applications:
```bash
bun run build:frontend
```
This script copies static styles to the public distribution and packages code modules into `public/bundle.js`.