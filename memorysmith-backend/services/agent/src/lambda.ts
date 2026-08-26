/**
 * AWS Lambda entrypoint for svc-agent. The Hono app is transport-agnostic;
 * this file is the only place that knows it runs on Lambda, and the only place
 * that wires the AWS-backed adapters.
 */

import { handle } from 'hono/aws-lambda';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { secretsManagerResolver } from './secrets.aws.js';

const config = loadConfig();

export const handler = handle(createApp(config, secretsManagerResolver(config.stateSecretId)));
