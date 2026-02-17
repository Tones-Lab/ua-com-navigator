import { useState } from 'react';

export default function useModalStack(baseZ = 1200, stepZ = 10) {
  const [modalStack, setModalStack] = useState<string[]>([]);

  const updateModalStack = (id: string, open: boolean) => {
    setModalStack((prev) => {
      if (open) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((entry) => entry !== id);
    });
  };

  const getModalOverlayStyle = (id: string, fallbackLevel = 0) => {
    const index = modalStack.indexOf(id);
    const level = index >= 0 ? index : fallbackLevel;
    return { zIndex: baseZ + level * stepZ };
  };

  return {
    updateModalStack,
    getModalOverlayStyle,
  };
}
