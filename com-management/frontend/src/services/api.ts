import axios, { AxiosInstance } from 'axios';
import { UAServer, Session, FcomFile, FcomObject } from '../types';

const API_BASE_URL = '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // Include cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Authentication
  async login(serverId: string, authType: 'basic' | 'certificate', credentials: any) {
    return this.client.post('/auth/login', {
      server_id: serverId,
      auth_type: authType,
      ...credentials,
    });
  }

  async logout() {
    return this.client.post('/auth/logout');
  }

  async getSession() {
    return this.client.get<Session>('/auth/session');
  }

  // Servers
  async listServers() {
    return this.client.get<UAServer[]>('/servers');
  }

  async switchServer(serverId: string, authType: 'basic' | 'certificate', credentials: any) {
    return this.client.post(`/servers/${serverId}/switch`, {
      auth_type: authType,
      ...credentials,
    });
  }

  // File Browser
  async browsePath(
    path?: string,
    filters?: { node?: string; vendor?: string; protocol_type?: string; search?: string },
  ) {
    return this.client.get('/files/browse', {
      params: {
        path: path || '/',
        ...filters,
      },
    });
  }

  async getFilePreview(fileId: string) {
    return this.client.get(`/files/${fileId}/preview`);
  }

  // File Editor
  async readFile(fileId: string, revision?: string) {
    return this.client.get<FcomFile>(`/files/read`, {
      params: { file_id: fileId, revision },
    });
  }

  async saveFile(fileId: string, content: any, etag: string, commitMessage: string) {
    return this.client.post(`/files/save`, {
      file_id: fileId,
      content,
      etag,
      commit_message: commitMessage,
    });
  }

  async getDiff(fileId: string, revisionA?: string, revisionB?: string) {
    return this.client.get(`/files/${fileId}/diff`, {
      params: {
        revision_a: revisionA,
        revision_b: revisionB,
      },
    });
  }

  async getHistory(fileId: string, limit?: number, offset?: number) {
    return this.client.get(`/files/${fileId}/history`, {
      params: { limit, offset },
    });
  }

  // Overrides
  async getOverrides(fileId: string) {
    return this.client.get('/overrides', { params: { file_id: fileId } });
  }

  async saveOverrides(fileId: string, overrides: any[], commitMessage: string) {
    return this.client.post('/overrides/save', {
      file_id: fileId,
      overrides,
      commit_message: commitMessage,
    });
  }

  // Testing
  async testObject(fileId: string, objectName: string) {
    const encoded = encodeURIComponent(fileId);
    return this.client.post(`/files/${encoded}/test`, { object_name: objectName });
  }

  async testAllObjects(fileId: string) {
    const encoded = encodeURIComponent(fileId);
    return this.client.post(`/files/${encoded}/test-all`);
  }

  // Broker servers
  async getBrokerServers() {
    return this.client.get('/broker/servers');
  }

  // MIB Browser
  async browseMibs(path?: string, options?: { search?: string; limit?: number; offset?: number }) {
    return this.client.get('/mibs/browse', {
      params: {
        path,
        search: options?.search,
        limit: options?.limit,
        offset: options?.offset,
      },
    });
  }

  async searchMibs(query: string, options?: { limit?: number; offset?: number }) {
    return this.client.get('/mibs/search', {
      params: {
        q: query,
        limit: options?.limit,
        offset: options?.offset,
      },
    });
  }

  async readMib(path: string) {
    return this.client.get('/mibs/read', { params: { path } });
  }

  async parseMib(path: string) {
    return this.client.get('/mibs/parse', { params: { path } });
  }

  async translateMibNames(module: string | null, names: string[]) {
    return this.client.post('/mibs/translate', {
      module,
      names,
    });
  }

  async getMibTranslateStatus() {
    return this.client.get('/mibs/translate/status');
  }

  async lookupMibOid(oid: string) {
    return this.client.get('/mibs/oid-lookup', { params: { oid } });
  }

  async runMib2Fcom(inputPath: string, outputName?: string, useParentMibs?: boolean) {
    return this.client.post('/mibs/mib2fcom', {
      inputPath,
      outputName,
      useParentMibs,
    });
  }

  async sendTrap(payload: {
    host: string;
    port?: number;
    community?: string;
    version?: string;
    trapOid: string;
    mibModule?: string;
    varbinds?: Array<{ oid: string; type?: string; value?: string }>;
  }) {
    return this.client.post('/mibs/trap/send', payload);
  }

  async snmpWalk(payload: {
    host: string;
    version?: string;
    community?: string;
    oid: string;
    mibModule?: string;
  }) {
    return this.client.post('/mibs/poll', payload);
  }

  // Legacy Conversion uploads
  async listLegacyUploads() {
    return this.client.get('/legacy/uploads');
  }

  async readLegacyUpload(pathId: string) {
    return this.client.get('/legacy/uploads/file', { params: { path: pathId } });
  }

  async readLegacyMatchFile(pathId: string) {
    return this.client.get('/legacy/match/file', { params: { path: pathId } });
  }

  async uploadLegacyFiles(files: File[], subdir?: string) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (subdir) {
      formData.append('subdir', subdir);
    }
    return this.client.post('/legacy/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async runLegacyConversion(payload?: {
    paths?: string[];
    vendor?: string;
    useMibs?: boolean;
    useLlm?: boolean;
  }) {
    return this.client.post('/legacy/convert', payload || {});
  }

  async getDevices(params?: { limit?: number; start?: number }) {
    return this.client.get('/devices', { params });
  }

  async getSnmpAccessProfile(accessId: string) {
    return this.client.get(`/snmp-access/${encodeURIComponent(accessId)}`);
  }

  // Schema
  async getSchema() {
    return this.client.get('/schema');
  }

  async getSchemaVersion() {
    return this.client.get('/schema/version');
  }

  async getEventsSchema() {
    return this.client.get('/events/schema');
  }

  async redeployFcomProcessor() {
    return this.client.post('/microservice/redeploy-fcom');
  }

  async getMicroserviceHealth() {
    return this.client.get('/microservice/health');
  }

  async getMicroserviceStatus(options?: { refresh?: boolean }) {
    return this.client.get('/microservice/status', {
      params: options?.refresh ? { refresh: '1' } : undefined,
    });
  }

  async deployMicroservice(name: string) {
    return this.client.post('/microservice/deploy-service', { name });
  }

  async redeployMicroservice(name: string) {
    return this.client.post('/microservice/redeploy-service', { name });
  }

  // Favorites
  async getFavorites(scope: 'fcom' | 'pcom' | 'mib') {
    return this.client.get('/favorites', { params: { scope } });
  }

  async addFavorite(favorite: {
    type: 'file' | 'folder';
    pathId: string;
    label: string;
    node?: string;
    scope: 'fcom' | 'pcom' | 'mib';
  }) {
    return this.client.post('/favorites', favorite, { params: { scope: favorite.scope } });
  }

  async removeFavorite(favorite: {
    type: 'file' | 'folder';
    pathId: string;
    scope: 'fcom' | 'pcom' | 'mib';
  }) {
    return this.client.delete('/favorites', {
      data: favorite,
      params: { scope: favorite.scope },
    });
  }

  // Folder Overview
  async getFolderOverview(node: string, limit: number = 25) {
    return this.client.get('/folders/overview', { params: { node, limit } });
  }

  async getFolderOverviewStatus() {
    return this.client.get('/folders/overview/status');
  }

  // Search
  async searchComs(query: string, scope: 'all' | 'name' | 'content' = 'all', limit: number = 200) {
    return this.client.get('/search', { params: { q: query, scope, limit } });
  }

  async getSearchStatus() {
    return this.client.get('/search/status');
  }

  async rebuildSearchIndex() {
    return this.client.post('/search/rebuild');
  }

  // Overview
  async getOverview() {
    return this.client.get('/overview');
  }

  async getOverviewStatus() {
    return this.client.get('/overview/status');
  }

  async rebuildOverviewIndex() {
    return this.client.post('/overview/rebuild');
  }

  async rebuildFolderOverviewCache(node?: string, limit: number = 25) {
    return this.client.post('/folders/overview/rebuild', { node, limit });
  }
}

export default new ApiClient();
