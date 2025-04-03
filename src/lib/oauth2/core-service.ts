export interface OAuth2PlatformConfig {
    clientId: string;
    clientSecret: string;
    scopes: string[];
    authUrl: string;
    tokenUrl: string;
    redirectUri: string;

    storageNamespace: string;
  }
  
  export interface OAuth2TokenSet {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  }

  
  export interface OAuth2Service {
    getAuthUrl(state: Record<string, any>): string;
    handleCallback(code: string): Promise<OAuth2TokenSet>;
    refreshToken(refreshToken: string): Promise<OAuth2TokenSet>;
    apiRequest(token: string, endpoint: string, params?: any): Promise<any>;
  }
  
  export type PlatformRegistry = Record<string, OAuth2PlatformConfig>;