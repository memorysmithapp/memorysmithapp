/**
 * The environment a round runs against, and the accounts it creates for itself
 * (architecture-guide.md, section 19).
 *
 * Every account is new, created through the Cognito admin API with no message
 * sent, and its subscription is asked for and approved through the product, the
 * way the functional suite does it. A creation case gets an account of its own,
 * so it never meets a notebook another run wrote: an executor that finds a good
 * Guidance already there copies it.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Browser } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readNotebookTree } from '../../commands/lib/notebook-tree.js';
import { ProductApi } from '../../commands/lib/product-api.js';
import { readText, REPOSITORY_ROOT } from '../../commands/lib/repository.js';
import { stackIdOf } from '../../commands/lib/teardown.js';
import { writeNotebookTree } from '../../commands/lib/write-notebook.js';
import { apiToken, createAccount, deleteAccount } from '../../functional/support/accounts.js';
import { connectThroughBrowser } from '../../functional/support/connector-flow.js';
import type { RunState } from '../../functional/support/state.js';
import type { NotebookSnapshot } from './checks.js';

/**
 * The client a round connects as. whoami shows the agent the name of its
 * connector, so it is named the way a person's own client is, and never after
 * an evaluation or a test.
 */
export const EVALUATION_CLIENT = { key: 'clients/claude-code.json', name: 'Claude Code' } as const;

export interface Account {
  readonly email: string;
  readonly password: string;
  readonly subscriptionId: string | null;
}

export interface EvaluationEnvironment {
  readonly name: string;
  readonly region: string;
  readonly site: string;
  readonly api: string;
  readonly mcp: string;
  readonly userPoolId: string;
  readonly webClientId: string;
  readonly version: string;
  readonly admin: Account;
  readonly accounts: Account[];
}

const neutralEmail = (person: string): string =>
  `${person}.${randomBytes(3).toString('hex')}@example.com`;

export async function openEnvironment(name: string): Promise<EvaluationEnvironment> {
  if (name === 'production') {
    throw new Error('The agent evaluation writes, and none of it runs against production.');
  }
  const declared = (
    JSON.parse(readText('memorysmith-infra/cdk.json')) as {
      context: { environments: Record<string, { region?: string; hostedZoneName?: string }> };
    }
  ).context.environments[name];
  if (!declared?.hostedZoneName) throw new Error(`cdk.json declares no ${name} environment.`);
  const region = declared.region ?? 'us-east-1';
  const zone = declared.hostedZoneName;

  const identity = stackIdOf(name, 'Identity');
  const outputs =
    (
      await new CloudFormationClient({ region }).send(
        new DescribeStacksCommand({ StackName: identity }),
      )
    ).Stacks?.[0]?.Outputs ?? [];
  const output = (key: string): string => {
    const value = outputs.find((each) => each.OutputKey === key)?.OutputValue;
    if (!value) throw new Error(`${identity} has no ${key} output.`);
    return value;
  };

  const api = `https://api.${zone}`;
  const health = (await (await fetch(`${api}/health`)).json()) as { version?: string };
  const base = {
    name,
    region,
    site: `https://${zone}`,
    api,
    mcp: `https://mcp.${zone}`,
    userPoolId: output('UserPoolId'),
    webClientId: output('WebClientId'),
    version: health.version ?? 'an unstated version',
  };
  const admin = await createAccount({
    region,
    userPoolId: base.userPoolId,
    email: neutralEmail('platform'),
    platformAdmin: true,
  });
  return { ...base, admin: { ...admin, subscriptionId: null }, accounts: [] };
}

/** A new account with an active subscription of its own and nothing in it. */
export async function freshAccount(
  environment: EvaluationEnvironment,
  person: string,
): Promise<Account> {
  const created = await createAccount({
    region: environment.region,
    userPoolId: environment.userPoolId,
    email: neutralEmail(person),
    platformAdmin: false,
  });
  const api = new ProductApi(environment.api);
  const { subscriptionId } = await api.call<{ subscriptionId: string }>(
    'POST',
    '/access/subscriptions',
    await apiToken(environment, created),
    { type: 'individual', quota: '1GB' },
  );
  await api.call(
    'PUT',
    `/access/platform/subscriptions/${subscriptionId}/status`,
    await apiToken(environment, environment.admin),
    { status: 'active' },
  );
  const account = { ...created, subscriptionId };
  environment.accounts.push(account);
  return account;
}

/** Writes a notebook tree into the account, by its path from the root of the repository. */
export async function seedTree(
  environment: EvaluationEnvironment,
  account: Account,
  path: string,
): Promise<string> {
  const tree = readNotebookTree(join(REPOSITORY_ROOT, path), basename(path));
  const written = await writeNotebookTree({
    api: new ProductApi(environment.api),
    // Fresh: the subscription claim is minted with the token.
    token: await apiToken(environment, account, true),
    tree,
  });
  return written.notebookId;
}

/** A token of the connector for the account, through the whole OAuth flow, in a browser of its own. */
export async function connectorToken(
  environment: EvaluationEnvironment,
  account: Account,
  browser: Browser,
): Promise<string> {
  const context = await browser.newContext();
  try {
    const token = await connectThroughBrowser({
      page: await context.newPage(),
      environment: environment.name,
      region: environment.region,
      site: environment.site,
      mcp: environment.mcp,
      account,
      client: EVALUATION_CLIENT,
    });
    return token.accessToken;
  } finally {
    await context.close();
  }
}

/** What whoami serves the account, which is where the index of skills is read from. */
export async function whoamiText(
  environment: EvaluationEnvironment,
  token: string,
): Promise<string> {
  const client = new Client({ name: EVALUATION_CLIENT.name, version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL('/mcp', environment.mcp), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  try {
    const answer = await client.callTool({ name: 'whoami', arguments: {} });
    const content = Array.isArray(answer.content) ? answer.content : [];
    return content.map((part) => String((part as { text?: unknown }).text ?? '')).join('\n');
  } finally {
    await client.close();
  }
}

/** Every notebook of the account, as the checks read it. */
export async function snapshot(
  environment: EvaluationEnvironment,
  account: Account,
): Promise<NotebookSnapshot[]> {
  const api = new ProductApi(environment.api);
  const token = await apiToken(environment, account, true);
  const listed = await api.call<{ notebookId: string }[]>('GET', '/knowledge/notebooks', token);

  const notebooks: NotebookSnapshot[] = [];
  for (const { notebookId } of listed) {
    const detail = await api.call<{
      name: string;
      guidance: { content: string } | null;
      folders: { folderId: string; name: string; description: string; hasTemplate: boolean }[];
    }>('GET', `/knowledge/notebooks/${notebookId}`, token);

    const folders = [];
    for (const folder of detail.folders) {
      const template = folder.hasTemplate
        ? await api.call<{ content: string | null }>(
            'GET',
            `/knowledge/notebooks/${notebookId}/folders/${folder.folderId}/template`,
            token,
          )
        : null;
      folders.push({
        folderId: folder.folderId,
        name: folder.name,
        description: folder.description,
        template: template?.content ?? null,
      });
    }

    const summaries = await api.call<{ noteId: string }[]>(
      'GET',
      `/knowledge/notebooks/${notebookId}/notes`,
      token,
    );
    const notes = [];
    for (const { noteId } of summaries) {
      const note = await api.call<{
        noteId: string;
        folderId: string;
        name: string | null;
        content: string;
      }>('GET', `/knowledge/notebooks/${notebookId}/notes/${noteId}`, token);
      notes.push({
        noteId: note.noteId,
        folderId: note.folderId,
        name: note.name,
        content: note.content,
      });
    }

    const health = await api.call<{ pendingLinks: unknown[] }>(
      'GET',
      `/discovery/notebooks/${notebookId}/health`,
      token,
    );
    notebooks.push({
      notebookId,
      name: detail.name,
      guidance: detail.guidance?.content ?? null,
      folders,
      notes,
      pendingLinks: health.pendingLinks.length,
    });
  }
  return notebooks;
}

/** The notebook as the product exports it, saved beside the run. */
export async function exportNotebook(
  environment: EvaluationEnvironment,
  account: Account,
  notebookId: string,
  file: string,
): Promise<boolean> {
  const job = await new ProductApi(environment.api).call<{ downloadUrl: string | null }>(
    'POST',
    `/portability/notebooks/${notebookId}/export`,
    await apiToken(environment, account),
  );
  if (!job.downloadUrl) return false;
  const archive = await fetch(job.downloadUrl);
  if (!archive.ok) return false;
  writeFileSync(file, Buffer.from(await archive.arrayBuffer()));
  return true;
}

/** Deletes every account the round created, the administrator last. */
export async function closeEnvironment(environment: EvaluationEnvironment): Promise<void> {
  const state = { region: environment.region, userPoolId: environment.userPoolId } as RunState;
  for (const account of [...environment.accounts, environment.admin]) {
    await deleteAccount(state, account);
  }
}
