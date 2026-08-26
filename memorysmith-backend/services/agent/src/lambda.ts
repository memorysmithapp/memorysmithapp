/**
 * AWS Lambda entrypoint for svc-agent. The Hono app is transport-agnostic;
 * this file is the only place that knows it runs on Lambda, and the only place
 * that wires the AWS-backed adapters.
 */

import { handle } from 'hono/aws-lambda';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { secretsManagerResolver } from './secrets.aws.js';
import { buildToolAdapter } from './main/composition-root.js';

const config = loadConfig();

/**
 * The composition root of svc-agent. In the modular monolith the gateways run
 * the use cases in process; when the contexts become separate deployables they
 * call the internal API over HTTP with IAM auth, and only this line changes
 * (architecture-guide.md, section 24).
 */
export const handler = handle(
  createApp(config, secretsManagerResolver(config.stateSecretId), buildToolAdapter()),
);
