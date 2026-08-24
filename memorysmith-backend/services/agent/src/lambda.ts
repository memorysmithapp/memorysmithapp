/**
 * AWS Lambda entrypoint for svc-agent. The Hono app is transport-agnostic;
 * this file is the only place that knows it runs on Lambda.
 */

import { handle } from 'hono/aws-lambda';
import { createApp } from './app.js';

export const handler = handle(createApp());
