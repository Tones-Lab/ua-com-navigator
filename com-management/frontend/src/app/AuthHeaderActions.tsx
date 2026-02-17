type AuthHeaderActionsProps = {
  microserviceIndicatorState: string;
  microserviceNeedsRedeploy: boolean;
  microserviceIndicatorTitle: string;
  microserviceIndicatorLabel: string | null;
  onOpenMicroserviceModal: () => void;
  userName?: string | null;
  onOpenUserMenu: () => void;
  onLogout: () => void;
};

export default function AuthHeaderActions({
  microserviceIndicatorState,
  microserviceNeedsRedeploy,
  microserviceIndicatorTitle,
  microserviceIndicatorLabel,
  onOpenMicroserviceModal,
  userName,
  onOpenUserMenu,
  onLogout,
}: AuthHeaderActionsProps) {
  return (
    <div className="header-actions">
      <button
        type="button"
        className={`microservice-indicator microservice-indicator-${microserviceIndicatorState}${
          microserviceNeedsRedeploy ? ' microservice-pulse' : ''
        }`}
        title={microserviceIndicatorTitle}
        aria-label={microserviceIndicatorTitle}
        onClick={onOpenMicroserviceModal}
      >
        {microserviceIndicatorLabel ?? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 4v6h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <button type="button" className="user-menu-button" onClick={onOpenUserMenu}>
        Welcome, {userName}
      </button>
      <button type="button" className="search-button logout-button" onClick={onLogout}>
        <span className="logout-icon" aria-hidden="true">
          🚪
        </span>
        Logout
      </button>
    </div>
  );
}
