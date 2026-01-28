import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * UA Service Client
 * Handles all HTTP communication with Unified Assurance REST API
 * Supports both basic auth and certificate-based auth
 */

interface UAClientConfig {
  hostname: string;
  port: number;
  auth_method: 'basic' | 'certificate';
  username?: string;
  password?: string;
  cert_path?: string;
  key_path?: string;
  ca_cert_path?: string;
  insecure_tls?: boolean;
}

export class UAClient {
  private client: AxiosInstance;
  private config: UAClientConfig;

  constructor(config: UAClientConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    const baseURL = `https://${this.config.hostname}:${this.config.port}/api`;
    const axiosConfig: AxiosRequestConfig = {
      baseURL,
      timeout: 10000,
    };

    // Configure authentication
    if (this.config.auth_method === 'basic') {
      if (!this.config.username || !this.config.password) {
        throw new Error('Username and password required for basic auth');
      }
      axiosConfig.auth = {
        username: this.config.username,
        password: this.config.password,
      };

      if (this.config.insecure_tls) {
        axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }
    } else if (this.config.auth_method === 'certificate') {
      if (!this.config.cert_path || !this.config.key_path) {
        throw new Error('Certificate and key paths required for certificate auth');
      }

      const httpsAgent = new https.Agent({
        cert: fs.readFileSync(this.config.cert_path),
        key: fs.readFileSync(this.config.key_path),
        ca: this.config.ca_cert_path ? fs.readFileSync(this.config.ca_cert_path) : undefined,
        rejectUnauthorized: !this.config.insecure_tls,
      });

      axiosConfig.httpAgent = httpsAgent;
      axiosConfig.httpsAgent = httpsAgent;
    }

    return axios.create(axiosConfig);
  }

  /**
   * List rules files from the FCOM repository
   */
  async listRules(path: string = '/', limit: number = 100, node?: string): Promise<any> {
    try {
      logger.info(`[UA] Listing rules at path: ${path}${node ? `, node: ${node}` : ''}`);
      const params = new URLSearchParams();
      if (node) {
        params.set('node', node);
      } else {
        params.set('path', path);
      }
      params.set('excludeMetadata', 'true');
      params.set('page', '1');
      params.set('start', '0');
      params.set('limit', String(limit));
      params.set('sort[0][property]', 'Path');
      params.set('sort[0][direction]', 'ASC');

      const query = params.toString();
      const response = await this.client.get(`/rule/Rules/read?${query}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error listing rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read a specific rules file
   */
  async readRule(id: string, revision?: string): Promise<any> {
    try {
      logger.info(`[UA] Reading rule: ${id}, revision: ${revision || 'HEAD'}`);
      const response = await this.client.get(`/rule/Rules/${id}`, {
        params: { revision },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error reading rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a rules file
   */
  async updateRule(id: string, content: any, commitMessage: string): Promise<any> {
    try {
      logger.info(`[UA] Updating rule: ${id}, message: ${commitMessage}`);
      const normalizedContent = (() => {
        if (typeof content === 'string') {
          return { RuleText: content };
        }
        if (content && typeof content === 'object') {
          if ('RuleText' in content) {
            return content;
          }
          return { RuleText: JSON.stringify(content, null, 2) };
        }
        return { RuleText: JSON.stringify(content, null, 2) };
      })();

      const pathName = String(id).split('/').pop() ?? String(id);

      const response = await this.client.put(
        `/rule/Rules/${id}`,
        {
          PathName: pathName,
          ClonedPath: id,
          CommitLog: commitMessage,
          RuleText: normalizedContent.RuleText ?? normalizedContent,
          commit_message: commitMessage,
          message: commitMessage,
          commitMessage,
          comment: commitMessage,
        },
        {
          params: {
            commit_message: commitMessage,
            message: commitMessage,
            comment: commitMessage,
          },
        },
      );
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error updating rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare two revisions of a rules file
   */
  async diffRules(id: string, revisionA: string = 'HEAD', revisionB: string = 'WORKING'): Promise<any> {
    try {
      logger.info(`[UA] Diffing rule: ${id}, ${revisionA} vs ${revisionB}`);
      const response = await this.client.get('/rule/Rules/readDiff', {
        params: { id, revision_a: revisionA, revision_b: revisionB },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error diffing rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get revision history for a rules file
   */
  async getHistory(id: string, limit: number = 20, offset: number = 0): Promise<any> {
    try {
      logger.info(`[UA] Getting history for rule: ${id}`);
      const response = await this.client.get('/rule/Rules/readRevisionHistory', {
        params: { id, limit, offset },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error getting rule history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revert a rules file to an earlier version
   */
  async revertRule(id: string, revision: string, commitMessage: string): Promise<any> {
    try {
      logger.info(`[UA] Reverting rule: ${id} to revision ${revision}`);
      const response = await this.client.put(`/rule/Rules/executeRevert/${id}`, {
        revision,
        commit_message: commitMessage,
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error reverting rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check syntax for a rules file
   */
  async checkSyntax(id: string, content: any): Promise<any> {
    try {
      logger.info(`[UA] Checking syntax for rule: ${id}`);
      const response = await this.client.post('/rule/Rules/executeCheckSyntax', {
        id,
        content,
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error checking syntax: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new rules file
   */
  async createRule(name: string, content: any, path: string = '/'): Promise<any> {
    try {
      logger.info(`[UA] Creating rule: ${name} at ${path}`);
      const response = await this.client.post('/rule/Rules', {
        name,
        content,
        path,
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error creating rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a rules file
   */
  async deleteRule(id: string, commitMessage: string): Promise<any> {
    try {
      logger.info(`[UA] Deleting rule: ${id}`);
      const response = await this.client.delete(`/rule/Rules/${id}`, {
        data: { commit_message: commitMessage },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error deleting rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a folder in the rules repository
   */
  async createFolder(path: string): Promise<any> {
    try {
      logger.info(`[UA] Creating folder: ${path}`);
      const response = await this.client.post('/rule/Rules/executeCreateFolder', {
        path,
      });
      return response.data;
    } catch (error: any) {
      logger.error(`[UA] Error creating folder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download a rules file
   */
  async downloadRule(id: string): Promise<Buffer> {
    try {
      logger.info(`[UA] Downloading rule: ${id}`);
      const response = await this.client.post('/rule/Rules/executeDownload', 
        { id },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error(`[UA] Error downloading rule: ${error.message}`);
      throw error;
    }
  }
}

export default UAClient;
