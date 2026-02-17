import { useCallback, useState } from 'react';
import { getApiErrorMessage } from '../utils/errorUtils';

type RunRequestOptions = {
  clearError?: boolean;
  fallbackError?: string;
  getErrorMessage?: (error: unknown) => string;
  rethrow?: boolean;
  captureError?: boolean;
};

export default function useRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(request: () => Promise<T>, options?: RunRequestOptions): Promise<T | undefined> => {
      setLoading(true);
      if (options?.clearError !== false) {
        setError(null);
      }
      try {
        return await request();
      } catch (err: unknown) {
        if (options?.captureError !== false) {
          const message = options?.getErrorMessage
            ? options.getErrorMessage(err)
            : getApiErrorMessage(err, options?.fallbackError || 'Request failed');
          setError(message);
        }
        if (options?.rethrow) {
          throw err;
        }
      } finally {
        setLoading(false);
      }
      return undefined;
    },
    [],
  );

  return {
    loading,
    setLoading,
    error,
    setError,
    run,
  };
}
