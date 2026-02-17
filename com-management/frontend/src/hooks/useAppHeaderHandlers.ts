import { useCallback } from 'react';
import { flushSync } from 'react-dom';

type UseAppHeaderHandlersArgs = any;

export default function useAppHeaderHandlers(args: UseAppHeaderHandlersArgs) {
  const {
    setRedeployError,
    setRedeployModalOpen,
    setCacheActionMessage,
    setShowUserMenu,
    handleLogout,
    handleAppTabChange,
  } = args;

  const onOpenMicroserviceModal = useCallback(() => {
    setRedeployError(null);
    setRedeployModalOpen(true);
  }, [setRedeployError, setRedeployModalOpen]);

  const onOpenUserMenu = useCallback(() => {
    flushSync(() => {
      setCacheActionMessage(null);
      setShowUserMenu(true);
    });
  }, [setCacheActionMessage, setShowUserMenu]);

  return {
    onTabChange: handleAppTabChange,
    onOpenMicroserviceModal,
    onOpenUserMenu,
    onLogout: handleLogout,
  };
}