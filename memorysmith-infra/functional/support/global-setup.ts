/**
 * Before any case: the environment the run goes against, and three accounts of
 * its own (architecture-guide.md, section 19).
 *
 * The accounts are created through the Cognito admin API with passwords nobody
 * keeps, and their subscriptions are asked for and approved through the
 * product API, the way a person and a platform administrator do: an owner, the
 * owner of a second subscription the first must never see, and a platform
 * administrator who holds no subscription at all.
 *
 * Production is refused before anything is read: the suite writes, and a test
 * never writes to production.
 */

import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { readText } from '../../commands/lib/repository.js';
import { stackIdOf } from '../../commands/lib/teardown.js';
import { apiToken, createAccount } from './accounts.js';
import { Api } from './api.js';
import { REPORT_DIRECTORY, writeState, type RunState, type TestAccount } from './state.js';

export default async function globalSetup(): Promise<void> {
  const environment = process.env['FUNCTIONAL_ENVIRONMENT'] ?? 'staging';
  if (environment === 'production') {
    throw new Error('The functional suite writes, and a test never writes to production.');
  }

  const declared = (
    JSON.parse(readText('memorysmith-infra/cdk.json')) as {
      context: {
        environments: Record<string, { region?: string; hostedZoneName?: string } | undefined>;
      };
    }
  ).context.environments[environment];
  if (!declared?.hostedZoneName)
    throw new Error(`cdk.json declares no ${environment} environment.`);

  const region = declared.region ?? 'us-east-1';
  const zone = declared.hostedZoneName;
  const identity = stackIdOf(environment, 'Identity');
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

  rmSync(REPORT_DIRECTORY, { recursive: true, force: true });

  const runId = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  const base = {
    runId,
    environment,
    region,
    version: process.env['FUNCTIONAL_VERSION'] || null,
    surfaces: {
      site: `https://${zone}`,
      api: `https://api.${zone}`,
      mcp: `https://mcp.${zone}`,
      auth: `https://auth.${zone}`,
    },
    userPoolId: output('UserPoolId'),
    webClientId: output('WebClientId'),
  };

  const account = (role: string, platformAdmin: boolean) =>
    createAccount({
      region,
      userPoolId: base.userPoolId,
      email: `functional-${runId}-${role}@example.com`,
      platformAdmin,
    });

  const admin = await account('admin', true);
  const api = new Api(base.surfaces.api);
  const adminApi = api.as(await apiToken(base, admin));

  /** A subscription asked for by its owner and made active by the administrator. */
  const owning = async (role: string): Promise<TestAccount> => {
    const created = await account(role, false);
    const own = api.as(await apiToken(base, created));
    const { subscriptionId } = await own.ok<{ subscriptionId: string }>(
      'POST',
      '/access/subscriptions',
      { type: 'individual', quota: '1GB' },
    );
    await adminApi.ok('PUT', `/access/platform/subscriptions/${subscriptionId}/status`, {
      status: 'active',
    });
    return { ...created, subscriptionId };
  };

  const state: RunState = {
    ...base,
    accounts: {
      owner: await owning('owner'),
      other: await owning('other'),
      admin: { ...admin, subscriptionId: null },
    },
  };
  writeState(state);
  process.stdout.write(
    `Functional run ${runId} against ${environment} (${base.surfaces.site}), serving ${state.version ?? 'an unstated version'}.\n`,
  );
}
