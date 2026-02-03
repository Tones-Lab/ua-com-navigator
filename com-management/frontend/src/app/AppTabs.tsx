import React from 'react';

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib';

type AppTabsProps = {
  activeApp: AppTab;
  onChange: (next: AppTab) => void;
};

const tabs: Array<{ key: AppTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'fcom', label: 'FCOM' },
  { key: 'pcom', label: 'PCOM' },
  { key: 'mib', label: 'MIB Browser' },
];

export default function AppTabs({ activeApp, onChange }: AppTabsProps) {
  return (
    <div className="app-nav" role="tablist" aria-label="Application navigation">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeApp === tab.key ? 'app-nav-button app-nav-button-active' : 'app-nav-button'}
          onClick={() => onChange(tab.key)}
          role="tab"
          aria-selected={activeApp === tab.key}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
