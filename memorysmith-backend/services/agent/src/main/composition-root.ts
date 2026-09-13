/**
 * Composition root of svc-agent. It is the only file that knows the other
 * contexts are reachable over HTTP; the tool adapter above it knows only the
 * gateway ports (architecture-guide.md, sections 13.1 and 24).
 */

import {
  HttpAccessGateway,
  HttpAuditGateway,
  HttpDiscoveryGateway,
  HttpKnowledgeGateway,
} from '../adapters/http-gateways.js';
import { deploymentFromVariables, type Deployment } from '@memorysmith/contracts';
import { McpToolAdapter } from '../mcp/tools.js';
import { SERVICE_VERSION } from '../mcp/environment.js';
import { HttpConnectorBinder, type RequestSigner } from '../connector-binding.js';

function internalApiOrigin(env: NodeJS.ProcessEnv): string {
  const origin = (env['INTERNAL_API_ORIGIN'] ?? '').replace(/\/$/, '');
  if (!origin) {
    throw new Error('Missing required environment variable: INTERNAL_API_ORIGIN');
  }
  return origin;
}

/** The deployment this function runs in, as the infrastructure declared it (23.3). */
export function deploymentOf(env: NodeJS.ProcessEnv = process.env): Deployment {
  return deploymentFromVariables(env, SERVICE_VERSION);
}

export function buildToolAdapter(env: NodeJS.ProcessEnv = process.env): McpToolAdapter {
  const origin = internalApiOrigin(env);
  return new McpToolAdapter(
    {
      access: new HttpAccessGateway(origin),
      knowledge: new HttpKnowledgeGateway(origin),
      discovery: new HttpDiscoveryGateway(origin),
      audit: new HttpAuditGateway(origin),
    },
    deploymentOf(env),
  );
}

/** What the token endpoint binds a connector through, with requests signed by `sign`. */
export function buildConnectorBinder(
  sign: RequestSigner,
  env: NodeJS.ProcessEnv = process.env,
): HttpConnectorBinder {
  return new HttpConnectorBinder(internalApiOrigin(env), sign);
}
