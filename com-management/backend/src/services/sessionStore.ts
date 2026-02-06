import { AuthRequest, Session, UAServer } from '../types';
import { getRedisClient } from './redisClient';

type SessionBundle = {
  session: Session;
  auth: AuthRequest;
  server: UAServer;
};

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 8 * 3600);
const SESSION_KEY_PREFIX = 'fcom:session:';

const buildSessionKey = (sessionId: string) => `${SESSION_KEY_PREFIX}${sessionId}`;

const serializeBundle = (bundle: SessionBundle) => {
  const payload = {
    session: {
      ...bundle.session,
      created_at: bundle.session.created_at.toISOString(),
      expires_at: bundle.session.expires_at.toISOString(),
    },
    auth: bundle.auth,
    server: bundle.server,
  };
  return JSON.stringify(payload);
};

const parseBundle = (raw: string): SessionBundle | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.session || !parsed?.auth || !parsed?.server) {
      return null;
    }
    const session = {
      ...parsed.session,
      created_at: new Date(parsed.session.created_at),
      expires_at: new Date(parsed.session.expires_at),
    } as Session;
    return {
      session,
      auth: parsed.auth as AuthRequest,
      server: parsed.server as UAServer,
    };
  } catch {
    return null;
  }
};

const touchSession = async (sessionId: string) => {
  const client = await getRedisClient();
  await client.expire(buildSessionKey(sessionId), SESSION_TTL_SECONDS);
};

export const setSession = async (session: Session, auth: AuthRequest, server: UAServer) => {
  const client = await getRedisClient();
  const key = buildSessionKey(session.session_id);
  const bundle: SessionBundle = { session, auth, server };
  await client.set(key, serializeBundle(bundle), { EX: SESSION_TTL_SECONDS });
};

export const getSessionContext = async (sessionId: string): Promise<SessionBundle | null> => {
  const client = await getRedisClient();
  const key = buildSessionKey(sessionId);
  const raw = await client.get(key);
  if (!raw) {
    return null;
  }
  const bundle = parseBundle(raw);
  if (!bundle) {
    return null;
  }
  await touchSession(sessionId);
  return bundle;
};

export const getSession = async (sessionId: string) => {
  const bundle = await getSessionContext(sessionId);
  return bundle?.session ?? null;
};

export const getCredentials = async (sessionId: string) => {
  const bundle = await getSessionContext(sessionId);
  return bundle?.auth ?? null;
};

export const getServer = async (sessionId: string) => {
  const bundle = await getSessionContext(sessionId);
  return bundle?.server ?? null;
};

export const clearSession = async (sessionId: string) => {
  const client = await getRedisClient();
  await client.del(buildSessionKey(sessionId));
};
