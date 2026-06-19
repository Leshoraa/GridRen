import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface AppHeaderProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  imageElement: HTMLImageElement | null;
  imageMeta: { name: string; size: string; dim: string };
  historyIndex: number;
  historyStackLength: number;
  handleUndo: () => void;
  handleRedo: () => void;
  exportHighRes: () => void;
  uiCollapsed: boolean;
  setUiCollapsed: (collapsed: boolean) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  theme,
  setTheme,
  imageElement,
  imageMeta,
  historyIndex,
  historyStackLength,
  handleUndo,
  handleRedo,
  exportHighRes,
  uiCollapsed,
  setUiCollapsed,
}) => {
  return (
    <header className="app-header">
      <div className="title-container">
        <div className="app-title">GridRen</div>
        <button
          className="theme-toggle-btn"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      <div className="app-metadata">
        {imageElement && (
          <>
            <div className="meta-item">File: <span>{imageMeta.name}</span></div>
            <div className="meta-item">Dim: <span>{imageMeta.dim}</span></div>
            <div className="meta-item">Size: <span>{imageMeta.size}</span></div>
            <div className="meta-item">History: <span>{historyIndex + 1}/{historyStackLength}</span></div>
          </>
        )}
      </div>
      <div className="app-controls-top">
        {imageElement && (
          <>
            <button className="btn" onClick={handleUndo} disabled={historyIndex <= 0}>Undo</button>
            <button className="btn" onClick={handleRedo} disabled={historyIndex >= historyStackLength - 1}>Redo</button>
            <button className="btn btn-accent" onClick={exportHighRes}>Export</button>
            <button
              className="btn"
              onClick={() => setUiCollapsed(!uiCollapsed)}
            >
              {uiCollapsed ? 'Expand UI' : 'Collapse UI'}
            </button>
          </>
        )}
      </div>
    </header>
  );
};
