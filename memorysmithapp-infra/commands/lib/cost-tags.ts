/**
 * Which tags the bill of the account is grouped by (#280).
 *
 * Every stack carries `app:project` and `app:environment`, and the CDK hands
 * them to every resource that takes a tag, but Cost Explorer and Budgets read a
 * tag only once it is activated as a cost allocation tag, which CloudFormation
 * cannot declare. Nothing here calls AWS: the command does, and what it asks
 * for is decided here, where a test can ask it too.
 */

/**
 * The tags the bill is grouped by. `app:version` is deliberately absent: it
 * changes on every release, and active it would split the same table into one
 * line per version.
 */
export const COST_TAGS = ['app:project', 'app:environment'] as const;

/** A tag as Cost Explorer lists it. */
export interface ListedTag {
  readonly TagKey?: string;
  readonly Status?: string;
}

/** What the command does about each tag, and what it says. */
export interface CostTagPlan {
  /** Listed and inactive: activated by this run. */
  readonly activate: string[];
  /** Listed and active already: nothing to do. */
  readonly active: string[];
  /**
   * Not listed at all. Billing lists a tag only once a tagged resource has been
   * billed, a day or so after the first delivery, so the command is run again
   * then.
   */
  readonly unseen: string[];
}

export function planCostTags(listed: readonly ListedTag[]): CostTagPlan {
  const status = new Map(listed.map((tag) => [tag.TagKey, tag.Status]));
  const plan: CostTagPlan = { activate: [], active: [], unseen: [] };
  for (const key of COST_TAGS) {
    const found = status.get(key);
    if (found === 'Active') plan.active.push(key);
    else if (found === undefined) plan.unseen.push(key);
    else plan.activate.push(key);
  }
  return plan;
}
