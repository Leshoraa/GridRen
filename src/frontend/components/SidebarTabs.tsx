import React from 'react';

export type TabType = 'presets' | 'basic' | 'hsl' | 'curves' | 'detail' | 'effects' | 'lens' | 'masks' | 'geometry' | 'eraser';

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
    { id: 'presets', label: 'Presets', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>palette</span> },
    { id: 'basic', label: 'Basic', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>tune</span> },
    { id: 'hsl', label: 'Mixer', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>instant_mix</span> },
    { id: 'curves', label: 'Curves', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>show_chart</span> },
    { id: 'detail', label: 'Detail', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span> },
    { id: 'effects', label: 'Effects', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span> },
    { id: 'lens', label: 'Lens', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>photo_camera</span> },
    { id: 'masks', label: 'Masks', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>layers</span> },
    { id: 'eraser', label: 'Eraser', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cleaning_services</span> },
    { id: 'geometry', label: 'Transform', icon: <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>crop</span> },
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
export default SidebarTabs;
