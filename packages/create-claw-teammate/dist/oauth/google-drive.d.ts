interface OAuthTokens {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}
export declare function googleDriveOAuthFlow(): Promise<OAuthTokens | null>;
export {};
