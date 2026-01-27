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
  async browsePath(path?: string, filters?: { vendor?: string; protocol_type?: string; search?: string }) {
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
    return this.client.get<FcomFile>(`/files/${fileId}/read`, {
      params: { revision },
    });
  }

  async saveFile(fileId: string, content: any, etag: string, commitMessage: string) {
    return this.client.post(`/files/${fileId}/save`, {
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

  // Testing
  async testObject(fileId: string, objectName: string) {
    return this.client.post(`/files/${fileId}/test`, { object_name: objectName });
  }

  async testAllObjects(fileId: string) {
    return this.client.post(`/files/${fileId}/test-all`);
  }

  // Schema
  async getSchema() {
    return this.client.get('/schema');
  }

  async getSchemaVersion() {
    return this.client.get('/schema/version');
  }
}

export default new ApiClient();
