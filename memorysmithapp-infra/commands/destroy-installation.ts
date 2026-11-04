/**
 * Tears an installation of somebody else down (#391): what `install-account`
 * and `deliver` brought up, taken down by one command.
 *
 *   pnpm -C memorysmithapp-infra destroy-installation --environment <name> [--preview] [--bootstrap]
 *
 * It reads the installation from `.env.<environment>`, as `install-account` and
 * `deliver` do, and refuses before it looks at a credential when `INSTALLATION`
 * is not set: the project's own installation has none, and nothing turns it
 * into something this command deletes. Then it refuses any account but the one
 * the installation names.
 *
 * `--preview` lists the stacks in the order they go and what they retain, and
 * changes nothing. Without it, the stacks go in the reverse of a delivery, then
 * Edge in us-east-1 and the delivery role of a fork, and then what no removal
 * policy deletes, by `lib/teardown-run.ts`, as staging is torn down.
 *
 * In a domain of its own, the records that validated its certificates go too
 * (#393): CloudFormation leaves them in the zone. What stays is said: the
 * hosted zone, which is the person's and whose name servers a delegation names; the key AWS manages for DynamoDB, which cannot be
 * deleted; and the CDK bootstrap, which `--bootstrap` removes too, region by
 * region, only where no other stack is left to deploy with it.
 */

import { DescribeStacksCommand, paginateListStacks } from '@aws-sdk/client-cloudformation';
import { DeleteRepositoryCommand, ECRClient } from '@aws-sdk/client-ecr';
import {
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  Route53Client,
  type ResourceRecordSet,
  type RRType,
} from '@aws-sdk/client-route-53';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { parseArgs } from 'node:util';
import { installationEnvironmentOf, loadInstallationFile } from '../installation/index.js';
import {
  bootstrapRefusalOf,
  describeRetained,
  installationRefusalOf,
  installationTeardownOrder,
  validationRecordsOf,
} from './lib/teardown.js';
import {
  clients,
  deleteStacks,
  messageOf,
  purge,
  purgeBucket,
  survey,
} from './lib/teardown-run.js';

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: process.env['ENVIRONMENT'] ?? 'staging' },
    preview: { type: 'boolean', default: false },
    bootstrap: { type: 'boolean', default: false },
  },
});

const nameOf = (error: unknown): unknown => (error as { name?: unknown }).name;
const say = (line: string): void => void process.stdout.write(`${line}\n`);

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---- Who asks, and for what --------------------------------------------------

const environment = values.environment;
if (environment !== 'production' && environment !== 'staging') {
  refuse(`There is no environment called "${environment}". Nothing was deleted.`);
}
loadInstallationFile(environment);
const installation = process.env['INSTALLATION']?.trim() || null;

const early = installationRefusalOf({
  installation,
  callerAccount: null,
  account: process.env['AWS_ACCOUNT_ID']?.trim(),
});
if (early) refuse(early);

const named = (() => {
  try {
    return installationEnvironmentOf(environment, { tryGetContext: () => undefined }, process.env);
  } catch (error) {
    return refuse(`${messageOf(error)} Nothing was deleted.`);
  }
})();
const { account, region } = named;

const caller = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
const refusal = installationRefusalOf({
  installation,
  callerAccount: caller.Account ?? '',
  account,
});
if (refusal) refuse(refusal);

// The certificates of CloudFront live in us-east-1 when the product has a
// domain of its own and lives elsewhere (#342).
const edge = region !== 'us-east-1' && named.hostedZoneName !== null;
const order = installationTeardownOrder({
  environment,
  installation: installation as string,
  region,
  edge,
});
const regions = [...new Set(order.map((each) => each.region))];

// ---- The records that validated its certificates (#393) ---------------------

const route53 = new Route53Client({ region: 'us-east-1' });
const zoneId = named.hostedZoneId;
const validation: ResourceRecordSet[] = [];
if (zoneId && named.hostedZoneName) {
  const sets: ResourceRecordSet[] = [];
  // Route 53 pages a zone by the name and type of the next record, not by a token.
  let next: { StartRecordName?: string; StartRecordType?: RRType; StartRecordIdentifier?: string } =
    {};
  for (;;) {
    const page = await route53.send(
      new ListResourceRecordSetsCommand({ HostedZoneId: zoneId, ...next }),
    );
    sets.push(...(page.ResourceRecordSets ?? []));
    if (!page.IsTruncated) break;
    next = {
      ...(page.NextRecordName ? { StartRecordName: page.NextRecordName } : {}),
      ...(page.NextRecordType ? { StartRecordType: page.NextRecordType } : {}),
      ...(page.NextRecordIdentifier ? { StartRecordIdentifier: page.NextRecordIdentifier } : {}),
    };
  }
  const chosen = new Set(
    validationRecordsOf(
      named.hostedZoneName,
      sets.map((set) => ({
        name: set.Name ?? '',
        type: set.Type ?? '',
        values: (set.ResourceRecords ?? []).map((each) => each.Value ?? ''),
      })),
    ).map((record) => record.name),
  );
  validation.push(...sets.filter((set) => set.Type === 'CNAME' && chosen.has(set.Name ?? '')));
}

say(`Tearing down ${installation} ${environment}, account ${account}, ${regions.join(' and ')}.`);

// ---- What goes ---------------------------------------------------------------

say('\nStacks, in the order they go');
const { present, retained } = await survey(order, say);

say('\nPurged after the stacks are gone');
for (const each of retained) say(`  ${describeRetained(each.retained)} (${each.region})`);
if (retained.length === 0) say('  nothing any stack retains');
for (const set of validation) say(`  record ${set.Name} CNAME, which validated a certificate`);
say('  the log groups of functions that no longer exist');

say('\nKept');
say(
  named.hostedZoneName
    ? `  the hosted zone ${named.hostedZoneName}: it is yours, and its delegation names its name servers`
    : '  no hosted zone: the installation answers on the default endpoints of AWS',
);
say('  the key AWS manages for DynamoDB, which AWS does not let anybody delete');
say(
  values.bootstrap
    ? `  the CDK bootstrap only where another stack still deploys with it (${regions.join(', ')})`
    : '  the CDK bootstrap: --bootstrap removes it too',
);

if (values.preview) {
  say('\nPreview: nothing was deleted.');
  process.exit(0);
}

say('\nDeleting');
const stopped = await deleteStacks(present, say);
if (stopped) {
  refuse(`${stopped}\nThe stacks after it were left as they are, since they depend on it.`);
}

say('\nPurging');
let failures = await purge({ retained, environment, installation, regions, say });
for (const set of validation) {
  try {
    await route53.send(
      new ChangeResourceRecordSetsCommand({
        HostedZoneId: zoneId ?? '',
        ChangeBatch: { Changes: [{ Action: 'DELETE', ResourceRecordSet: set }] },
      }),
    );
    say(`  record ${set.Name} CNAME: deleted`);
  } catch (error) {
    // Deleted meanwhile, by a stack or by hand: the record is gone either way.
    if (nameOf(error) === 'InvalidChangeBatch' && /not found/i.test(messageOf(error))) {
      say(`  record ${set.Name} CNAME: already gone`);
      continue;
    }
    failures += 1;
    say(`  record ${set.Name} CNAME: could not be deleted, ${messageOf(error)}`);
  }
}

// ---- The bootstrap, on request ----------------------------------------------

if (values.bootstrap) {
  say('\nThe CDK bootstrap');
  for (const where of regions) {
    const { cloudformation } = clients(where);
    const others: string[] = [];
    for await (const page of paginateListStacks({ client: cloudformation }, {})) {
      for (const stack of page.StackSummaries ?? []) {
        if (stack.StackStatus === 'DELETE_COMPLETE' || stack.StackName === 'CDKToolkit') continue;
        if (stack.StackName) others.push(stack.StackName);
      }
    }
    const kept = bootstrapRefusalOf(where, others);
    if (kept) {
      say(`  ${kept}`);
      continue;
    }
    const toolkit = await cloudformation
      .send(new DescribeStacksCommand({ StackName: 'CDKToolkit' }))
      .then((found) => found.Stacks?.[0] ?? null)
      .catch(() => null);
    if (!toolkit) {
      say(`  ${where}: no bootstrap`);
      continue;
    }
    // Its bucket and its repository are retained, and a stack refuses to go
    // while a bucket of its own still holds objects.
    const output = (key: string): string | undefined =>
      toolkit.Outputs?.find((each) => each.OutputKey === key)?.OutputValue;
    const bucket = output('BucketName');
    const repository = output('ImageRepositoryName');
    try {
      if (bucket) say(`  bucket ${bucket}: ${await purgeBucket(bucket, where)}`);
      if (repository) {
        await new ECRClient({ region: where })
          .send(new DeleteRepositoryCommand({ repositoryName: repository, force: true }))
          .catch((error: Error) => {
            if (error.name !== 'RepositoryNotFoundException') throw error;
          });
        say(`  repository ${repository}: deleted`);
      }
      const failed = await deleteStacks([{ stack: 'CDKToolkit', region: where }], () => undefined);
      if (failed) throw new Error(failed.trim());
      say(`  ${where}: CDKToolkit deleted`);
    } catch (error) {
      failures += 1;
      say(`  ${where}: the bootstrap could not be deleted, ${messageOf(error)}`);
    }
  }
}

if (failures > 0) {
  refuse(`\nThe stacks are gone, and ${failures} resource(s) above are still standing.`);
}
say(`\n${installation} ${environment} is gone. What stays is listed above.`);
