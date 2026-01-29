export interface UAServer {
  server_id: string;
  server_name: string;
  hostname: string;
  port: number;
  environment: 'dev' | 'test' | 'staging' | 'prod';
  svn_url: string;
}

export interface Session {
  session_id: string;
  user: string;
  server_id: string;
  auth_method: 'basic' | 'certificate';
  expires_at: string;
  ua_login?: any;
}

export interface FcomObject {
  '@objectName': string;
  description?: string;
  certification?: string;
  test?: string;
  tests?: string;
  event?: Record<string, any>;
  trap?: Record<string, any>;
  preProcessors?: Array<Record<string, any>>;
}

export interface FcomFile {
  file_id: string;
  path: string;
  revision: string;
  last_modified: string;
  last_author: string;
  etag: string;
  content: {
    objects?: FcomObject[];
    [key: string]: any;
  };
  validation_errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FilePreview {
  file_id: string;
  path: string;
  size: number;
  last_modified: string;
  last_author: string;
  object_count: number;
  objects_preview: Array<{
    '@objectName': string;
    description?: string;
  }>;
}
