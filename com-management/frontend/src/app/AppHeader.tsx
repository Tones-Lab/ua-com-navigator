import AppTabs from './AppTabs';
import AuthHeaderActions from './AuthHeaderActions';

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

type AppHeaderProps = {
  isAuthenticated: boolean;
  activeApp: AppTab;
  onTabChange: (nextTab: AppTab) => void;
  microserviceIndicatorState: string;
  microserviceNeedsRedeploy: boolean;
  microserviceIndicatorTitle: string;
  microserviceIndicatorLabel: string | null;
  onOpenMicroserviceModal: () => void;
  userName?: string | null;
  onOpenUserMenu: () => void;
  onLogout: () => void;
};

export default function AppHeader({
  isAuthenticated,
  activeApp,
  onTabChange,
  microserviceIndicatorState,
  microserviceNeedsRedeploy,
  microserviceIndicatorTitle,
  microserviceIndicatorLabel,
  onOpenMicroserviceModal,
  userName,
  onOpenUserMenu,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <h1>COM Curation &amp; Management</h1>
      {isAuthenticated && <AppTabs activeApp={activeApp} onChange={onTabChange} />}
      {isAuthenticated && (
        <AuthHeaderActions
          microserviceIndicatorState={microserviceIndicatorState}
          microserviceNeedsRedeploy={microserviceNeedsRedeploy}
          microserviceIndicatorTitle={microserviceIndicatorTitle}
          microserviceIndicatorLabel={microserviceIndicatorLabel}
          onOpenMicroserviceModal={onOpenMicroserviceModal}
          userName={userName}
          onOpenUserMenu={onOpenUserMenu}
          onLogout={onLogout}
        />
      )}
    </header>
  );
}
