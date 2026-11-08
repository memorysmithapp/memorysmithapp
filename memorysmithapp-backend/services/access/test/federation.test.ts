/**
 * The first sign-in through the organization's identity provider (#395):
 * one account per e-mail, linked once, and what each installation gives a
 * person who has none (RN-ACC-039, RN-ACC-040, RN-SUB-026).
 */

import { describe, expect, it } from 'vitest';
import { Instant, UserId } from '@memorysmithapp/kernel';
import {
  FederatedSignIn,
  type FederatedAccounts,
  type FederationPolicy,
  type FirstSignIn,
  type PoolAccount,
} from '../src/application/federation.js';
import { linkedProvidersOf } from '../src/adapters/outbound/cognito/CognitoFederatedAccounts.js';
import { identityOf } from '../src/adapters/inbound/pre-sign-up.js';
import {
  InMemoryAccessDatabase,
  InMemoryOnboarding,
} from '../src/adapters/outbound/memory/InMemoryAccess.js';
import { StorageQuota, type Email } from '../src/domain/values.js';
import { RecordingEventPublisher } from './recording-publisher.js';

class Pool implements FederatedAccounts {
  readonly accounts = new Map<string, PoolAccount>();
  readonly links: Array<{ username: string; provider: string; id: string }> = [];
  private next = 0;

  add(email: string, name: string | null = null, linkedProviders: string[] = []): PoolAccount {
    const userId = UserId.create(`user-${++this.next}`);
    if (!userId.ok) throw new Error('A user id of the test was refused');
    const account: PoolAccount = {
      userId: userId.value,
      username: email,
      name,
      linkedProviders,
    };
    this.accounts.set(email, account);
    return account;
  }

  async find(email: Email): Promise<PoolAccount | null> {
    return this.accounts.get(email.value) ?? null;
  }

  async create(email: Email, name: string | null): Promise<PoolAccount> {
    return this.add(email.value, name);
  }

  async link(account: PoolAccount, provider: string, id: string): Promise<void> {
    this.links.push({ username: account.username, provider, id });
  }

  async setName(account: PoolAccount, name: string): Promise<void> {
    this.accounts.set(account.username, { ...account, name });
  }
}

function setUp(firstSignIn: FirstSignIn, overrides: Partial<FederationPolicy> = {}) {
  const pool = new Pool();
  const db = new InMemoryAccessDatabase();
  const events = new RecordingEventPublisher();
  const signIn = new FederatedSignIn(pool, new InMemoryOnboarding(db, events), {
    firstSignIn,
    emailClaim: 'email',
    requireVerified: false,
    quota: StorageQuota.HALF_GIGABYTE,
    ...overrides,
  });
  return { pool, db, events, signIn };
}

const first = {
  provider: 'Acme',
  providerUserId: 'f3b1c2d4-0000-4000-8000-000000000001',
  email: 'Ana@Acme.example',
  emailVerified: 'true',
  name: 'Ana from the realm',
  at: Instant.now(),
};

describe('one account per e-mail, whichever way the person signs in (RN-ACC-039)', () => {
  it('links the identity to the account that already holds the e-mail, and keeps its name', async () => {
    const { pool, signIn } = setUp('request');
    const existing = pool.add('ana@acme.example', 'Ana Typed');

    const linked = await signIn.execute(first);

    expect(linked.ok && linked.value).toEqual({ userId: existing.userId, created: false });
    expect(pool.links).toEqual([
      { username: 'ana@acme.example', provider: 'Acme', id: first.providerUserId },
    ]);
    expect(pool.accounts.get('ana@acme.example')?.name).toBe('Ana Typed');
  });

  it("fills the name of an account that has none with the provider's, once (RN-ACC-021)", async () => {
    const { pool, signIn } = setUp('request');
    pool.add('ana@acme.example');

    await signIn.execute(first);

    expect(pool.accounts.get('ana@acme.example')?.name).toBe('Ana from the realm');
  });

  it('refuses a second identity of the same provider claiming an e-mail already linked', async () => {
    const { pool, signIn } = setUp('request');
    pool.add('ana@acme.example', 'Ana', ['Acme']);

    const refused = await signIn.execute(first);

    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('CONFLICT');
      expect(refused.error.message).toContain('ana@acme.example');
    }
    expect(pool.links).toEqual([]);
  });

  it('refuses a sign-in that brings no address, naming the claim', async () => {
    const { pool, signIn } = setUp('request', { emailClaim: 'preferred_username' });

    const refused = await signIn.execute({ ...first, email: undefined });

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toContain('preferred_username');
    expect(pool.accounts.size).toBe(0);
  });

  it('refuses a claim that is not an address, such as a bare login', async () => {
    const { signIn } = setUp('request', { emailClaim: 'preferred_username' });

    const refused = await signIn.execute({ ...first, email: 'ana' });

    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toContain('"ana"');
  });

  it('refuses an address the provider does not verify, unless the installation trusts it', async () => {
    const strict = setUp('request', { requireVerified: true });
    const refused = await strict.signIn.execute({ ...first, emailVerified: 'false' });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.message).toContain('IDP_TRUST_EMAIL');

    const trusting = setUp('request', { requireVerified: false });
    const taken = await trusting.signIn.execute({ ...first, emailVerified: 'false' });
    expect(taken.ok).toBe(true);
  });
});

describe('what a person with no account finds (RN-ACC-040, RN-SUB-026)', () => {
  it('request: an account with no subscription, which then asks for one', async () => {
    const { pool, db, signIn } = setUp('request');

    const made = await signIn.execute(first);

    expect(made.ok && made.value.created).toBe(true);
    expect(pool.accounts.get('ana@acme.example')?.name).toBe('Ana from the realm');
    expect(pool.links).toHaveLength(1);
    expect(db.subscriptions.size).toBe(0);
  });

  it('prepared: nothing, and the refusal says to ask whoever operates the installation', async () => {
    const { pool, signIn } = setUp('prepared');

    const refused = await signIn.execute(first);

    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('NOT_FOUND');
      expect(refused.error.message).toContain('prepare');
    }
    expect(pool.accounts.size).toBe(0);
    expect(pool.links).toEqual([]);
  });

  it('prepared: an account prepared beforehand is linked', async () => {
    const { pool, signIn } = setUp('prepared');
    pool.add('ana@acme.example', 'Ana');

    expect((await signIn.execute(first)).ok).toBe(true);
    expect(pool.links).toHaveLength(1);
  });

  it('automatic: an account with an active subscription of the declared quota', async () => {
    const { db, events, signIn } = setUp('automatic');

    const made = await signIn.execute(first);

    expect(made.ok).toBe(true);
    const [entry] = [...db.subscriptions.values()];
    expect(entry?.subscription.status.name).toBe('active');
    expect(entry?.subscription.quota.name).toBe('500MB');
    expect(made.ok && entry?.subscription.ownerId.equals(made.value.userId)).toBe(true);
    expect(events.ofType('SubscriptionRequested')).toHaveLength(1);
    expect(events.ofType('SubscriptionApproved')).toHaveLength(1);
    expect(db.links.size).toBe(1);
  });

  it('automatic: an account that already owns a subscription is given no second one', async () => {
    const { db, signIn } = setUp('automatic');
    const once = await signIn.execute({ ...first, provider: 'Other' });
    expect(db.subscriptions.size).toBe(1);

    const again = await signIn.execute(first);

    expect(once.ok && again.ok && again.value.userId.equals(once.value.userId)).toBe(true);
    expect(db.subscriptions.size).toBe(1);
  });
});

describe('what the trigger reads from Cognito', () => {
  it('names the provider and the identity of a federated sign-up, and nothing else', () => {
    expect(
      identityOf({
        triggerSource: 'PreSignUp_ExternalProvider',
        userName: 'Acme_f3b1c2d4-0000-4000-8000-000000000001',
      }),
    ).toEqual({ provider: 'Acme', providerUserId: 'f3b1c2d4-0000-4000-8000-000000000001' });
    expect(
      identityOf({ triggerSource: 'PreSignUp_AdminCreateUser', userName: 'ana@acme.example' }),
    ).toBeNull();
    expect(
      identityOf({ triggerSource: 'PreSignUp_ExternalProvider', userName: 'Acme_' }),
    ).toBeNull();
  });

  it('reads the providers already linked from the identities attribute', () => {
    expect(
      linkedProvidersOf(
        '[{"userId":"1","providerName":"Acme","providerType":"OIDC","primary":"false"}]',
      ),
    ).toEqual(['Acme']);
    expect(linkedProvidersOf(undefined)).toEqual([]);
    expect(linkedProvidersOf('not json')).toEqual([]);
  });
});
