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
  created_at: Date;
  expires_at: Date;
  ua_login?: any;
  can_edit_rules?: boolean;
}

export interface FcomObject {
  '@objectName': string;
  description?: string;
  certification?: string;
  test?: string;
  tests?: string;
  event?: any;
  trap?: any;
  preProcessors?: any[];
}

export interface FcomFile {
  file_id: string;
  path: string;
  revision: string;
  last_modified: Date;
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

export interface AuthRequest {
  server_id: string;
  auth_type: 'basic' | 'certificate';
  username?: string;
  password?: string;
  cert_path?: string;
  key_path?: string;
  ca_cert_path?: string;
}
