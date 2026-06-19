import React from 'react';
import { Palette, Sliders, TrendingUp, Layers, Crop } from 'lucide-react';

type TabType = 'presets' | 'adjustments' | 'curves' | 'masks' | 'crop';

interface SidebarTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  uiCollapsed: boolean;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  setActiveTab,
  uiCollapsed,
}) => {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'presets', label: 'Presets', icon: <Palette size={15} /> },
    { id: 'adjustments', label: 'Adjust', icon: <Sliders size={15} /> },
    { id: 'curves', label: 'Curves', icon: <TrendingUp size={15} /> },
    { id: 'masks', label: 'Masks', icon: <Layers size={15} /> },
    { id: 'crop', label: 'Crop', icon: <Crop size={15} /> },
  ];

  return (
    <div className="sidebar-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id && !uiCollapsed ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          title={tab.label}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
