/**
 * Runtime configuration for the svc-agent Lambda.
 * Every value is injected by the CDK stack; nothing is hardcoded here.
 */
export interface AgentConfig {
  /** Public origin of this service, e.g. https://mcp.memorysmith.app */
  publicOrigin: string;
  /** Cognito user pool issuer, e.g. https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXX */
  cognitoIssuer: string;
  /** Cognito hosted-UI domain origin, e.g. https://memorysmith-auth.auth.us-east-1.amazoncognito.com */
  cognitoDomain: string;
  /** The single pre-registered Cognito app client used by the CIMD proxy. */
  proxyClientId: string;
  /** HMAC secret used to sign the state that correlates the two OAuth legs. */
  stateSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };
  return {
    publicOrigin: required('PUBLIC_ORIGIN').replace(/\/$/, ''),
    cognitoIssuer: required('COGNITO_ISSUER').replace(/\/$/, ''),
    cognitoDomain: required('COGNITO_DOMAIN').replace(/\/$/, ''),
    proxyClientId: required('PROXY_CLIENT_ID'),
    stateSecret: required('STATE_SECRET'),
  };
}
