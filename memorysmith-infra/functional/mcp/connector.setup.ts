/**
 * Connects the suite to the connector the way a person connects an agent
 * (architecture-guide.md, section 13.3), once per run and before any MCP case.
 *
 * The connector accepts only tokens issued to its proxy client, and that client
 * signs in through the authorization code flow and nothing else, on purpose. So
 * the whole flow runs here, in Chromium, as it runs for a person: the run
 * publishes its Client ID Metadata Document on the site of the environment,
 * asks the connector for a code, signs in on the managed login, catches the
 * redirect on the loopback and redeems the code with its PKCE verifier. The
 * token lives an hour, longer than a run.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { expect, test as setup } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { stackIdOf } from '../../commands/lib/teardown.js';
import {
  authorizeUrl,
  CLIENT_METADATA_KEY,
  clientMetadata,
  pkce,
  tokenRequest,
} from '../support/connector-client.js';
import { writeConnectorToken } from '../support/connector-state.js';
import { signInOnManagedLogin } from '../support/managed-login.js';
import { readState } from '../support/state.js';

setup(
  'connects the suite to the connector through the whole OAuth flow, in a browser',
  async ({ page }) => {
    const state = readState();

    // The document that names the suite, where the connector will fetch it.
    const frontend = stackIdOf(state.environment, 'Frontend');
    const outputs =
      (
        await new CloudFormationClient({ region: state.region }).send(
          new DescribeStacksCommand({ StackName: frontend }),
        )
      ).Stacks?.[0]?.Outputs ?? [];
    const bucket = outputs.find((output) => output.OutputKey === 'SiteBucketName')?.OutputValue;
    if (!bucket) throw new Error(`${frontend} has no SiteBucketName output.`);
    const metadata = clientMetadata(state.surfaces.site);
    await new S3Client({ region: state.region }).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: CLIENT_METADATA_KEY,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
        CacheControl: 'no-store',
      }),
    );

    // The loopback, listening on a free port for the one redirect it expects.
    let arrived: (url: URL) => void = () => undefined;
    const redirected = new Promise<URL>((resolve) => {
      arrived = resolve;
    });
    const server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('The functional suite is connected.');
      arrived(new URL(request.url ?? '/', 'http://127.0.0.1'));
    });
    await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
    const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`;

    try {
      const proof = pkce();
      const sent = randomBytes(16).toString('hex');
      await page.goto(
        authorizeUrl({
          mcp: state.surfaces.mcp,
          clientId: metadata.client_id,
          redirectUri,
          challenge: proof.challenge,
          state: sent,
        }),
      );
      await signInOnManagedLogin(page, state.accounts.owner);

      const callback = await Promise.race([
        redirected,
        new Promise<never>((_, fail) =>
          setTimeout(
            () => fail(new Error('The connector never redirected to the loopback.')),
            90_000,
          ),
        ),
      ]);
      expect(callback.searchParams.get('state')).toBe(sent);
      expect(callback.searchParams.get('iss')).toBe(state.surfaces.mcp);
      const code = callback.searchParams.get('code');
      if (!code) throw new Error(`The redirect carried no code: ${callback.search}`);

      const exchanged = await fetch(`${state.surfaces.mcp}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequest({
          code,
          verifier: proof.verifier,
          clientId: metadata.client_id,
          redirectUri,
        }),
      });
      expect(exchanged.status).toBe(200);
      const tokens = (await exchanged.json()) as { access_token: string; refresh_token?: string };

      writeConnectorToken({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        clientId: metadata.client_id,
        clientName: metadata.client_name,
      });
    } finally {
      server.close();
    }
  },
);
