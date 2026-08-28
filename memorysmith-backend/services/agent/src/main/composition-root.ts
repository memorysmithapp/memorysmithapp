/**
 * Composition root of svc-agent. It is the only file that knows the other
 * contexts are reachable over HTTP; the tool adapter above it knows only the
 * gateway ports (architecture-guide.md, sections 13.1 and 24).
 */

import {
  HttpAuditGateway,
  HttpDiscoveryGateway,
  HttpKnowledgeGateway,
} from '../adapters/http-gateways.js';
import { McpToolAdapter } from '../mcp/tools.js';

export function buildToolAdapter(env: NodeJS.ProcessEnv = process.env): McpToolAdapter {
  const origin = (env['INTERNAL_API_ORIGIN'] ?? '').replace(/\/$/, '');
  if (!origin) {
    throw new Error('Missing required environment variable: INTERNAL_API_ORIGIN');
  }
  return new McpToolAdapter({
    knowledge: new HttpKnowledgeGateway(origin),
    discovery: new HttpDiscoveryGateway(origin),
    audit: new HttpAuditGateway(origin),
  });
}
