/**
 * What tearing staging down deletes, in which order, and what it refuses
 * (architecture-guide.md, section 20).
 *
 * Nothing here calls AWS. The command does, and every question it has to answer
 * before it deletes something is answered here, where a test can ask it too.
 */

/**
 * The stacks of the product, in the order a delivery deploys them. `bin/app.ts`
 * declares the same stacks, and a test holds the two together, because a
 * command never imports a stack.
 */
export const DELIVERY_ORDER = [
  'Network',
  'Frontend',
  'Data',
  'Identity',
  'Api',
  'Projections',
  'Agent',
  'FrontendRelease',
] as const;

/** The only environment that is ever torn down. */
export const DISPOSABLE = 'staging';

/** The id of a stack of an environment, as `config/environments.ts` writes it. */
export function stackIdOf(environment: string, name: string): string {
  return `Memorysmith${environment.charAt(0).toUpperCase()}${environment.slice(1)}${name}`;
}

/**
 * Why nothing may be deleted, or null. Production is refused before any
 * credential is looked at, so `callerAccount` is null on the first ask: it has
 * no destroy path, and no account id written anywhere turns one into it.
 */
export function refusalOf(input: {
  readonly environment: string;
  readonly callerAccount: string | null;
  readonly environmentAccount: string | undefined;
}): string | null {
  if (input.environment !== DISPOSABLE) {
    return `Only staging is ever torn down: ${input.environment} has no destroy path. Nothing was deleted.`;
  }
  if (!input.environmentAccount) {
    return 'cdk.json names no account for staging. Nothing was deleted.';
  }
  if (input.callerAccount !== null && input.callerAccount !== input.environmentAccount) {
    return (
      `These credentials belong to account ${input.callerAccount}, and staging lives in ` +
      `${input.environmentAccount}. Nothing was deleted.`
    );
  }
  return null;
}

/**
 * The reverse of a delivery, an order every dependency between the stacks
 * already agrees with. The roles GitHub delivers with are not in it: they belong
 * to the account, and a teardown of staging never names them.
 */
export function teardownOrder(environment: string): string[] {
  return [...DELIVERY_ORDER].reverse().map((name) => stackIdOf(environment, name));
}

export interface StackResource {
  readonly type: string;
  readonly physicalId: string;
}

/** What deleting a stack can leave standing, and the teardown deletes afterwards. */
export type Retained =
  | { readonly kind: 'table'; readonly name: string }
  | { readonly kind: 'bucket'; readonly name: string }
  | { readonly kind: 'user-pool'; readonly id: string };

/**
 * The tables, the content bucket and the user pool retain by policy: they are
 * what must never go by accident in production, and what goes on purpose here.
 * They are listed BEFORE the stacks are deleted, because afterwards nothing
 * says which table or bucket was theirs. A bucket a stack deletes on its own is
 * listed too, and is found already gone.
 */
export function retainedOf(resources: readonly StackResource[]): Retained[] {
  const found: Retained[] = [];
  for (const resource of resources) {
    if (!resource.physicalId) continue;
    switch (resource.type) {
      case 'AWS::DynamoDB::Table':
      case 'AWS::DynamoDB::GlobalTable':
        found.push({ kind: 'table', name: resource.physicalId });
        break;
      case 'AWS::S3::Bucket':
        found.push({ kind: 'bucket', name: resource.physicalId });
        break;
      case 'AWS::Cognito::UserPool':
        found.push({ kind: 'user-pool', id: resource.physicalId });
        break;
    }
  }
  return found;
}

export function describeRetained(retained: Retained): string {
  switch (retained.kind) {
    case 'table':
      return `table ${retained.name}`;
    case 'bucket':
      return `bucket ${retained.name}`;
    case 'user-pool':
      return `user pool ${retained.id}`;
  }
}

/**
 * The log groups Lambda created for functions of this environment that no
 * longer exist. CloudFormation never owned them, so deleting a stack walks past
 * them.
 */
export function orphanLogGroups(input: {
  readonly environment: string;
  readonly groups: readonly string[];
  readonly functions: readonly string[];
}): string[] {
  const prefix = `/aws/lambda/${stackIdOf(input.environment, '')}`;
  const alive = new Set(input.functions);
  return input.groups.filter(
    (group) => group.startsWith(prefix) && !alive.has(group.slice('/aws/lambda/'.length)),
  );
}

/** A delete of objects takes at most a thousand keys at a time. */
export function chunks<T>(items: readonly T[], size = 1000): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
