/**
 * Waits until the sending identity of an environment is verified
 * (architecture-guide.md, sections 17 and 20).
 *
 *   pnpm -C memorysmith-infra wait-for-email-identity --identity stg.memorysmith.app
 *
 * Cognito sends through SES only from a verified identity, and a new one is
 * verified only once SES has read the DKIM records the network stack published
 * in the zone. On an environment raised from zero the delivery therefore deploys
 * the network first, waits here, and only then deploys identity.
 */

import { GetEmailIdentityCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: { identity: { type: 'string' }, timeout: { type: 'string', default: '1800' } },
});

if (!values.identity) {
  console.error('wait-for-email-identity needs --identity.');
  process.exit(1);
}

const ses = new SESv2Client({});
const deadline = Date.now() + Number(values.timeout) * 1000;

while (Date.now() < deadline) {
  const found = await ses
    .send(new GetEmailIdentityCommand({ EmailIdentity: values.identity }))
    .catch((error: { name?: string }) => {
      if (error.name === 'NotFoundException') return null;
      throw error;
    });
  if (found?.VerifiedForSendingStatus) {
    process.stdout.write(`${values.identity} is verified for sending.\n`);
    process.exit(0);
  }
  console.error(
    `${values.identity} is not verified yet (DKIM ${found?.DkimAttributes?.Status ?? 'not created'}).`,
  );
  await sleep(20_000);
}

console.error(`${values.identity} is still not verified after ${values.timeout} seconds.`);
process.exit(1);
