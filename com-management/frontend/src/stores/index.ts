import { create } from 'zustand';
import { Session, UAServer } from '../types';

interface SessionState {
  session: Session | null;
  servers: UAServer[];
  currentServer: UAServer | null;
  isAuthenticated: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
  setServers: (servers: UAServer[]) => void;
  setCurrentServer: (server: UAServer) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  servers: [],
  currentServer: null,
  isAuthenticated: false,
  setSession: (session) =>
    set({
      session,
      isAuthenticated: true,
    }),
  clearSession: () =>
    set({
      session: null,
      isAuthenticated: false,
      currentServer: null,
    }),
  setServers: (servers) => set({ servers }),
  setCurrentServer: (server) => set({ currentServer: server }),
}));

interface EditorState {
  openFileId: string | null;
  unsavedChanges: boolean;
  currentRevision: string;
  setOpenFile: (fileId: string, revision: string) => void;
  clearOpenFile: () => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  openFileId: null,
  unsavedChanges: false,
  currentRevision: 'HEAD',
  setOpenFile: (fileId, revision) =>
    set({
      openFileId: fileId,
      currentRevision: revision,
      unsavedChanges: false,
    }),
  clearOpenFile: () =>
    set({
      openFileId: null,
      unsavedChanges: false,
    }),
  setUnsavedChanges: (hasChanges) =>
    set({ unsavedChanges: hasChanges }),
}));
