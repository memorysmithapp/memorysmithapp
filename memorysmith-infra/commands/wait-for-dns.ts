/**
 * Waits until a name resolves an A record on the public internet
 * (architecture-guide.md, sections 17 and 20).
 *
 *   pnpm -C memorysmith-infra wait-for-dns --name stg.memorysmith.app
 *
 * Cognito refuses a sign-in domain whose parent resolves no A record, and the
 * site of an environment only gets that record from its hosting stack. On an
 * environment raised from zero, the delivery therefore deploys the hosting
 * first, waits here, and only then deploys identity. A public resolver that
 * cached the absence of the name keeps saying so until that negative answer
 * expires, which is why this polls instead of asking once.
 */

import { Resolver } from 'node:dns/promises';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

const { values } = parseArgs({
  options: { name: { type: 'string' }, timeout: { type: 'string', default: '900' } },
});

if (!values.name) {
  console.error('wait-for-dns needs --name.');
  process.exit(1);
}

const resolver = new Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);
const deadline = Date.now() + Number(values.timeout) * 1000;

while (Date.now() < deadline) {
  const addresses = await resolver.resolve4(values.name).catch(() => [] as string[]);
  if (addresses.length > 0) {
    process.stdout.write(`${values.name} resolves to ${addresses.join(', ')}.\n`);
    process.exit(0);
  }
  console.error(`${values.name} does not resolve yet.`);
  await sleep(15_000);
}

console.error(`${values.name} still resolves no A record after ${values.timeout} seconds.`);
process.exit(1);
