import type { FormEvent } from 'react';
import InlineMessage from '../components/InlineMessage';

type ServerOption = {
  value: string;
  label: string;
};

type SignInScreenProps = {
  serverId: string;
  setServerId: (value: string) => void;
  serverOptions: ServerOption[];
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string | null;
  loading: boolean;
  onSubmit: (event: FormEvent) => void;
};

export default function SignInScreen({
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
}: SignInScreenProps) {
  return (
    <div className="auth-screen">
      <div className="login-card">
        <h2>Sign in</h2>
        <form onSubmit={onSubmit} className="login-form">
          <label>
            Server
            <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
              <option value="" disabled>
                Select a server
              </option>
              {serverOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <input type="hidden" name="authType" value="basic" />

          <label>
            Username
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <InlineMessage tone="error">{error}</InlineMessage>}
          <button type="submit" disabled={loading || !serverId}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
