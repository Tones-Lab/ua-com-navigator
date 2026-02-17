export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const asRecord =
    typeof error === 'object' && error !== null && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;
  if (!asRecord) {
    return fallback;
  }

  const response =
    typeof asRecord.response === 'object' &&
    asRecord.response !== null &&
    !Array.isArray(asRecord.response)
      ? (asRecord.response as Record<string, unknown>)
      : null;
  const data =
    response && typeof response.data === 'object' && response.data !== null && !Array.isArray(response.data)
      ? (response.data as Record<string, unknown>)
      : null;

  if (data && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (typeof asRecord.message === 'string' && asRecord.message.trim()) {
    return asRecord.message;
  }
  return fallback;
};
