/**
 * OAuth 2.1 discovery documents served by the proxy
 * (architecture-guide.md, section 13.3, items 1, 2 and 5).
 *
 * The Protected Resource Metadata points at the proxy itself as the
 * authorization server; the RFC 8414 document advertises CIMD support and
 * deliberately omits registration_endpoint (no DCR: it would create an app
 * client in the user pool for every connection).
 */

import type { AgentConfig } from './config.js';

/** RFC 9728 Protected Resource Metadata for the MCP endpoint (item 1). */
export function protectedResourceMetadata(config: AgentConfig): Record<string, unknown> {
  return {
    resource: `${config.publicOrigin}/mcp`,
    authorization_servers: [config.publicOrigin],
    bearer_methods_supported: ['header'],
    resource_name: 'MemorySmith MCP server',
  };
}

/** RFC 8414 Authorization Server Metadata for the proxy issuer (items 2 and 5). */
export function authorizationServerMetadata(config: AgentConfig): Record<string, unknown> {
  return {
    issuer: config.publicOrigin,
    authorization_endpoint: `${config.publicOrigin}/authorize`,
    token_endpoint: `${config.publicOrigin}/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    scopes_supported: ['openid', 'email', 'profile'],
    // registration_endpoint deliberately absent: DCR is not supported (item 5).
  };
}
