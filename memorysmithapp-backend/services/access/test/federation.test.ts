/**
 * The first sign-in through the organization's identity provider (#395):
 * one account per e-mail, linked once, and what each installation gives a
 * person who has none (RN-ACC-039, RN-ACC-040, RN-SUB-026).
 */

import { describe, expect, it } from 'vitest';
import { Instant, SubscriptionContext, UserId } from '@memorysmithapp/kernel';
import {
  FederatedSignIn,
  type DirectoryPicture,
  type FederatedAccounts,
  type FederatedFaces,
  type FederationPolicy,
  type FirstSignIn,
  type PoolAccount,
} from '../src/application/federation.js';
import { linkedProvidersOf } from '../src/adapters/outbound/cognito/CognitoFederatedAccounts.js';
import { identityOf } from '../src/adapters/inbound/pre-sign-up.js';
import {
  InMemoryAccessDatabase,
  InMemoryAvatarRepository,
  InMemoryOnboarding,
} from '../src/adapters/outbound/memory/InMemoryAccess.js';
import { GraphDirectoryPictures } from '../src/adapters/outbound/graph/GraphDirectoryPictures.js';
import { AvatarSource, Email, StorageQuota } from '../src/domain/values.js';
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

/** A PNG as its first bytes say, which is all `supports` reads in these tests. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function facesOf(
  db: InMemoryAccessDatabase,
  picture: DirectoryPicture | null | 'no directory',
  asked: string[] = [],
): FederatedFaces {
  return {
    avatarsOf: (owner, subscription) => {
      const context = SubscriptionContext.fromClaims({
        sub: owner.value,
        subscription_id: subscription.value,
        subscription_status: 'active',
      });
      if (!context.ok) throw new Error('A context of the test was refused');
      return new InMemoryAvatarRepository(context.value, db);
    },
    directory:
      picture === 'no directory'
        ? null
        : {
            pictureOf: async (email) => {
              asked.push(email.value);
              return picture;
            },
          },
    types: {
      accepted: ['image/png', 'image/jpeg', 'image/webp'],
      supports: (mime, bytes) => mime === 'image/png' && bytes[0] === 0x89,
    },
  };
}

function setUp(
  firstSignIn: FirstSignIn,
  overrides: Partial<FederationPolicy> = {},
  picture?: DirectoryPicture | null | 'no directory',
  asked: string[] = [],
) {
  const pool = new Pool();
  const db = new InMemoryAccessDatabase();
  const events = new RecordingEventPublisher();
  const signIn = new FederatedSignIn(
    pool,
    new InMemoryOnboarding(db, events),
    {
      firstSignIn,
      emailClaim: 'email',
      requireVerified: false,
      quota: StorageQuota.HALF_GIGABYTE,
      ...overrides,
    },
    picture === undefined ? null : facesOf(db, picture, asked),
  );
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

describe('the face of a federated person, set once on the first sign-in (RN-ACC-046, #561)', () => {
  it("keeps the picture of the organization's directory as the person's upload", async () => {
    const asked: string[] = [];
    const { db, signIn } = setUp('automatic', {}, { mime: 'image/png', bytes: PNG }, asked);

    expect((await signIn.execute(first)).ok).toBe(true);

    expect(asked).toEqual(['ana@acme.example']);
    const [face] = [...db.avatars.values()];
    expect(face?.source.name).toBe('upload');
    expect(face?.mime).toBe('image/png');
    expect(face?.picture).toEqual(PNG);
  });

  it('gives the initials, never Gravatar, when the directory answers nothing', async () => {
    const { db, signIn } = setUp('automatic', {}, null);

    expect((await signIn.execute(first)).ok).toBe(true);

    const [face] = [...db.avatars.values()];
    expect(face?.source.name).toBe('initials');
    expect(face?.picture).toBeNull();
  });

  it('gives the initials when there is no directory to ask', async () => {
    const { db, signIn } = setUp('automatic', {}, 'no directory');

    await signIn.execute(first);

    expect([...db.avatars.values()][0]?.source.name).toBe('initials');
  });

  it('refuses a picture too large, of a type not kept, or whose bytes say otherwise', async () => {
    for (const picture of [
      { mime: 'image/png', bytes: new Uint8Array(64 * 1024 + 1).fill(0x89) },
      { mime: 'image/gif', bytes: PNG },
      { mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
      { mime: 'image/png', bytes: new Uint8Array() },
    ]) {
      const { db, signIn } = setUp('automatic', {}, picture);
      await signIn.execute(first);
      expect([...db.avatars.values()][0]?.source.name).toBe('initials');
    }
  });

  it('never replaces a face already kept in the subscription', async () => {
    const { db, signIn } = setUp('automatic', {}, { mime: 'image/png', bytes: PNG });
    expect((await signIn.execute(first)).ok).toBe(true);
    const [key] = [...db.avatars.keys()];
    db.avatars.set(key!, { source: AvatarSource.GRAVATAR, picture: null, mime: null });

    // The pool of the test records links without marking the account, so the
    // same identity comes through again and finds the face already kept.
    expect((await signIn.execute(first)).ok).toBe(true);

    expect(db.avatars.get(key!)?.source.name).toBe('gravatar');
  });

  it('sets no face for a person who owns no subscription', async () => {
    const asked: string[] = [];
    const { db, signIn } = setUp('request', {}, { mime: 'image/png', bytes: PNG }, asked);

    expect((await signIn.execute(first)).ok).toBe(true);

    expect(db.avatars.size).toBe(0);
    expect(asked).toEqual([]);
  });
});

describe('the photo Microsoft Graph keeps, asked with the app credential (#561)', () => {
  type Call = { url: string; init: RequestInit | undefined };

  function graph(answers: Array<(call: Call) => Response>) {
    const calls: Call[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), init };
      calls.push(call);
      const answer = answers.shift();
      if (!answer) throw new Error(`Nothing answers ${call.url}`);
      return answer(call);
    }) as typeof fetch;
    const pictures = new GraphDirectoryPictures(
      { tenant: 'tenant-1', clientId: 'client-1', secret: async () => 's3cret' },
      2000,
      fetchFn,
    );
    return { calls, pictures };
  }
  const email = Email.create('ana@acme.example');
  if (!email.ok) throw new Error('An address of the test was refused');
  const token = () => Response.json({ access_token: 'graph-token' });

  it('asks for a token by client credentials, then the photo by the address', async () => {
    const { calls, pictures } = graph([
      token,
      () => new Response(PNG, { headers: { 'content-type': 'image/png' } }),
    ]);

    const found = await pictures.pictureOf(email.value);

    expect(found?.mime).toBe('image/png');
    expect(found?.bytes).toEqual(PNG);
    expect(calls[0]?.url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    const form = new URLSearchParams(String(calls[0]?.init?.body));
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_id')).toBe('client-1');
    expect(form.get('client_secret')).toBe('s3cret');
    expect(form.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(calls[1]?.url).toBe(
      'https://graph.microsoft.com/v1.0/users/ana%40acme.example/photos/240x240/$value',
    );
    expect(new Headers(calls[1]?.init?.headers).get('authorization')).toBe('Bearer graph-token');
  });

  it('falls back to the photo as kept when the size is not one of its own', async () => {
    const { calls, pictures } = graph([
      token,
      () => new Response(null, { status: 404 }),
      () => new Response(PNG, { headers: { 'content-type': 'image/jpeg; charset=binary' } }),
    ]);

    expect((await pictures.pictureOf(email.value))?.mime).toBe('image/jpeg');
    expect(calls[2]?.url).toBe(
      'https://graph.microsoft.com/v1.0/users/ana%40acme.example/photo/$value',
    );
  });

  it('answers null without retrying when Graph refuses, as it does without the permission', async () => {
    const { calls, pictures } = graph([token, () => new Response(null, { status: 401 })]);

    expect(await pictures.pictureOf(email.value)).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('answers null when no token is given, or anything throws', async () => {
    expect(
      await graph([() => new Response('{}', { status: 401 })]).pictures.pictureOf(email.value),
    ).toBeNull();
    expect(
      await graph([
        () => {
          throw new Error('network');
        },
      ]).pictures.pictureOf(email.value),
    ).toBeNull();
  });
});
