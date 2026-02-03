import { AuthRequest, Session, UAServer } from '../types';

const sessions = new Map<string, Session>();
const credentials = new Map<string, AuthRequest>();
const servers = new Map<string, UAServer>();

export const setSession = (session: Session, auth: AuthRequest, server: UAServer) => {
  sessions.set(session.session_id, session);
  credentials.set(session.session_id, auth);
  servers.set(session.session_id, server);
};

export const getSession = (sessionId: string) => sessions.get(sessionId);
export const getCredentials = (sessionId: string) => credentials.get(sessionId);
export const getServer = (sessionId: string) => servers.get(sessionId);

export const clearSession = (sessionId: string) => {
  sessions.delete(sessionId);
  credentials.delete(sessionId);
  servers.delete(sessionId);
};
