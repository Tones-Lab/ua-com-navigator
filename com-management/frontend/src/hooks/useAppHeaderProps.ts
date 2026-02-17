import { useMemo } from 'react';

type UseAppHeaderPropsArgs = any;

export default function useAppHeaderProps(args: UseAppHeaderPropsArgs) {
  const {
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
  } = args;

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}