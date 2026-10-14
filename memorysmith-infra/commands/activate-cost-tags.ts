/**
 * Activates the tags the bill of the account is grouped by (architecture-guide.md,
 * section 17; #280).
 *
 *   AWS_PROFILE=<profile> pnpm -C memorysmith-infra activate-cost-tags
 *
 * A step of bringing an account up, run once from a workstation and again
 * whenever it says a tag is not listed yet: it is idempotent, activating only
 * what is inactive. It is not part of a delivery, so the roles GitHub delivers
 * with never gain a permission over billing.
 */

import {
  CostExplorerClient,
  ListCostAllocationTagsCommand,
  UpdateCostAllocationTagsStatusCommand,
} from '@aws-sdk/client-cost-explorer';
import { COST_TAGS, planCostTags } from './lib/cost-tags.js';

const say = (line: string): void => void process.stdout.write(`${line}\n`);

// Cost Explorer answers in us-east-1 whatever the region of the product.
const ce = new CostExplorerClient({ region: 'us-east-1' });

const listed = await ce.send(
  new ListCostAllocationTagsCommand({ TagKeys: [...COST_TAGS], Type: 'UserDefined' }),
);
const plan = planCostTags(listed.CostAllocationTags ?? []);

if (plan.activate.length > 0) {
  const answer = await ce.send(
    new UpdateCostAllocationTagsStatusCommand({
      CostAllocationTagsStatus: plan.activate.map((TagKey) => ({ TagKey, Status: 'Active' })),
    }),
  );
  const failed = answer.Errors ?? [];
  for (const error of failed) {
    console.error(`${error.TagKey} was not activated: ${error.Code} ${error.Message ?? ''}`.trim());
  }
  if (failed.length > 0) process.exit(1);
}

for (const key of plan.activate) say(`${key} activated.`);
for (const key of plan.active) say(`${key} was active already.`);
for (const key of plan.unseen) {
  say(
    `${key} is not listed by billing yet: a tag is listed once a resource carrying it has been billed. Run this again a day after the first delivery.`,
  );
}
