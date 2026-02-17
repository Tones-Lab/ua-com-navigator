import { useMemo } from 'react';

type UseSignInScreenPropsArgs = any;

export default function useSignInScreenProps(args: UseSignInScreenPropsArgs) {
  const {
    serverId,
    setServerId,
    serverOptions,
    username,
    setUsername,
    password,
    setPassword,
    error,
    loading,
    onSubmit,
  } = args;

  return useMemo(
    () => ({
      serverId,
      setServerId,
      serverOptions,
      username,
      setUsername,
      password,
      setPassword,
      error,
      loading,
      onSubmit,
    }),
    [
      serverId,
      setServerId,
      serverOptions,
      username,
      setUsername,
      password,
      setPassword,
      error,
      loading,
      onSubmit,
    ],
  );
}