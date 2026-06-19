import React from 'react';
import { Palette, Sliders, TrendingUp, Layers } from 'lucide-react';

interface SidebarTabsProps {
  activeTab: 'presets' | 'adjustments' | 'curves' | 'masks';
  setActiveTab: (tab: 'presets' | 'adjustments' | 'curves' | 'masks') => void;
  uiCollapsed: boolean;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  uiCollapsed,
}) => {
  if (uiCollapsed) return null;

  return (
    <div className="sidebar-tabs">
      <button
        className={`tab-btn ${activeTab === 'presets' && !uiCollapsed ? 'active' : ''}`}
        onClick={() => setActiveTab('presets')}
        title="Presets"
      >
        <Palette size={16} />
        <span>Presets</span>
      </button>
      <button
        className={`tab-btn ${activeTab === 'adjustments' && !uiCollapsed ? 'active' : ''}`}
        onClick={() => setActiveTab('adjustments')}
        title="Adjustments"
      >
        <Sliders size={16} />
        <span>Adjust</span>
      </button>
      <button
        className={`tab-btn ${activeTab === 'curves' && !uiCollapsed ? 'active' : ''}`}
        onClick={() => setActiveTab('curves')}
        title="Tone Curves"
      >
        <TrendingUp size={16} />
        <span>Curves</span>
      </button>
      <button
        className={`tab-btn ${activeTab === 'masks' && !uiCollapsed ? 'active' : ''}`}
        onClick={() => setActiveTab('masks')}
        title="Selective Masks"
      >
        <Layers size={16} />
        <span>Masks</span>
      </button>
    </div>
  );
};
