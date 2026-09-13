/**
 * Connecting to the connector the way a person connects an agent
 * (architecture-guide.md, section 13.3).
 *
 * The connector accepts only tokens issued to its proxy client, and that client
 * signs in through the authorization code flow and nothing else, on purpose. So
 * the whole flow runs in Chromium, as it runs for a person: the caller's Client
 * ID Metadata Document is published on the site of the environment, the
 * connector is asked for a code, the account signs in on the managed login, the
 * redirect is caught on the loopback and the code is redeemed with its PKCE
 * verifier. The token lives an hour.
 *
 * The functional suite connects through it once per run, and the agent
 * evaluation once per round, each as a client of its own.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { stackIdOf } from '../../commands/lib/teardown.js';
import {
  authorizeUrl,
  clientMetadata,
  FUNCTIONAL_CLIENT,
  pkce,
  tokenRequest,
  type ConnectorClient,
} from './connector-client.js';
import type { ConnectorToken } from './connector-state.js';
import { signInOnManagedLogin } from './managed-login.js';

export async function connectThroughBrowser(input: {
  readonly page: Page;
  readonly environment: string;
  readonly region: string;
  readonly site: string;
  readonly mcp: string;
  readonly account: { readonly email: string; readonly password: string };
  readonly client?: ConnectorClient;
}): Promise<ConnectorToken> {
  const client = input.client ?? FUNCTIONAL_CLIENT;

  // The document that names the client, where the connector will fetch it.
  const frontend = stackIdOf(input.environment, 'Frontend');
  const outputs =
    (
      await new CloudFormationClient({ region: input.region }).send(
        new DescribeStacksCommand({ StackName: frontend }),
      )
    ).Stacks?.[0]?.Outputs ?? [];
  const bucket = outputs.find((output) => output.OutputKey === 'SiteBucketName')?.OutputValue;
  if (!bucket) throw new Error(`${frontend} has no SiteBucketName output.`);
  const metadata = clientMetadata(input.site, client);
  await new S3Client({ region: input.region }).send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: client.key,
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
    response.end('Connected.');
    arrived(new URL(request.url ?? '/', 'http://127.0.0.1'));
  });
  await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
  const redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`;

  try {
    const proof = pkce();
    const sent = randomBytes(16).toString('hex');
    await input.page.goto(
      authorizeUrl({
        mcp: input.mcp,
        clientId: metadata.client_id,
        redirectUri,
        challenge: proof.challenge,
        state: sent,
      }),
    );
    await signInOnManagedLogin(input.page, input.account);

    const callback = await Promise.race([
      redirected,
      new Promise<never>((_, fail) =>
        setTimeout(
          () => fail(new Error('The connector never redirected to the loopback.')),
          90_000,
        ),
      ),
    ]);
    if (callback.searchParams.get('state') !== sent) {
      throw new Error('The redirect carried a state this flow never sent.');
    }
    if (callback.searchParams.get('iss') !== input.mcp) {
      throw new Error(`The redirect named ${callback.searchParams.get('iss')} as its issuer.`);
    }
    const code = callback.searchParams.get('code');
    if (!code) throw new Error(`The redirect carried no code: ${callback.search}`);

    const exchanged = await fetch(`${input.mcp}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: tokenRequest({
        code,
        verifier: proof.verifier,
        clientId: metadata.client_id,
        redirectUri,
      }),
    });
    if (exchanged.status !== 200) {
      throw new Error(
        `The connector refused the code: ${exchanged.status} ${await exchanged.text()}`,
      );
    }
    const tokens = (await exchanged.json()) as { access_token: string; refresh_token?: string };
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      clientId: metadata.client_id,
      clientName: metadata.client_name,
    };
  } finally {
    server.close();
  }
}
