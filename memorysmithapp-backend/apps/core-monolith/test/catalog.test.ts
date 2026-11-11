/**
 * The community catalog (#360): a model its owner publishes, which a stranger
 * finds, reads with no account and creates a notebook from once signed in,
 * which anybody signed in may report and the operator may withdraw, and which
 * its owner withdraws at any time, with nothing created from it touched.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { UserId } from '@memorysmithapp/kernel';
import { Email, PersonName } from '@memorysmithapp/svc-access/domain/values';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;

let harness: App;
let ownerSubscription: string;
let notebookId: string;

const OWNER = { token: 'token-owner', sub: 'user-owner', email: 'owner@example.com' };
const STRANGER = { token: 'token-stranger', sub: 'user-stranger', email: 'stranger@example.com' };
const OPERATOR = 'platform-token';

async function call(
  token: string | null,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function onboard(input: { token: string; sub: string; email: string }): Promise<string> {
  harness.verifier.issue(input.token, { sub: input.sub, email: input.email });
  const created = await call(input.token, '/access/subscriptions', { method: 'POST', body: {} });
  const { subscriptionId } = await json<{ subscriptionId: string }>(created);
  await call(OPERATOR, `/access/platform/subscriptions/${subscriptionId}/approve`, {
    method: 'POST',
    body: { status: 'active' },
  });
  harness.verifier.issue(input.token, {
    sub: input.sub,
    email: input.email,
    subscription_id: subscriptionId,
    subscription_status: 'active',
  });
  const email = Email.create(input.email);
  const user = UserId.create(input.sub);
  if (email.ok && user.ok) harness.accounts.register(email.value, user.value);
  return subscriptionId;
}

async function named(email: string, name: string): Promise<void> {
  const account = Email.create(email);
  const person = PersonName.create(name);
  if (account.ok && person.ok) await harness.accountDirectory.setName(account.value, person.value);
}

/** A model with a parameter, in the subscription of a token. */
async function modelOf(token: string, name: string): Promise<string> {
  const { notebookId: id } = await json<{ notebookId: string }>(
    await call(token, '/knowledge/notebooks', {
      method: 'POST',
      body: { name, description: 'Licitações de {{orgao}}' },
    }),
  );
  const { folderId } = await json<{ folderId: string }>(
    await call(token, `/knowledge/notebooks/${id}/folders`, {
      method: 'POST',
      body: { name: 'Editais', description: 'Um edital por nota.' },
    }),
  );
  await call(token, `/knowledge/notebooks/${id}/notes`, {
    method: 'POST',
    body: { folderId, content: '---\nname: Edital de exemplo\n---\n\nPublicado por {{orgao}}.\n' },
  });
  await call(token, `/portability/models/${id}`, {
    method: 'PUT',
    body: {
      objective: 'Follow the public procurement of one public body',
      description: 'Notices, bids and contracts',
      audience: 'Procurement analysts',
      parameters: [{ name: 'orgao', description: 'The public body', type: 'text', required: true }],
    },
  });
  return id;
}

function publish(token: string, id: string, acceptLicence = true): Promise<Response> {
  return call(token, `/portability/models/${id}/publication`, {
    method: 'PUT',
    body: { language: 'pt-BR', acceptLicence },
  });
}

beforeEach(async () => {
  harness = buildTestApp();
  harness.verifier.issue(OPERATOR, {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  ownerSubscription = await onboard(OWNER);
  await onboard(STRANGER);
  await named(OWNER.email, 'Ana Pereira');
  notebookId = await modelOf(OWNER.token, 'Licitações {{orgao}}');
});

describe('publishing a model to the community (#360)', () => {
  it('asks for a name to show, never the e-mail, and for CC0 1.0', async () => {
    // A name that is the e-mail is no name: the catalog never shows an e-mail.
    await named(OWNER.email, OWNER.email);
    const unnamed = await publish(OWNER.token, notebookId);
    expect(unnamed.status).toBe(400);
    expect((await json<{ details?: { reason?: string } }>(unnamed)).details?.reason).toBe(
      'AUTHOR_NAME',
    );

    await named(OWNER.email, 'Ana Pereira');
    const unlicensed = await publish(OWNER.token, notebookId, false);
    expect(unlicensed.status).toBe(409);
    expect((await json<{ details?: { reason?: string } }>(unlicensed)).details?.reason).toBe(
      'LICENCE',
    );

    const published = await publish(OWNER.token, notebookId);
    expect(published.status).toBe(200);
    const model = await json<Record<string, unknown>>(published);
    expect(model).toMatchObject({ author: 'Ana Pereira', licence: 'CC0-1.0', language: 'pt-BR' });
    // What anybody sees names no subscription, no owner and no e-mail.
    expect(JSON.stringify(model)).not.toContain(OWNER.email);
    expect(JSON.stringify(model)).not.toContain(ownerSubscription);

    // The list of the owner's models says it is published, and as which
    // entry, which is how its cards know it for the owner's own (#418).
    const listed = await json<{
      models: Array<{ notebookId: string; publication: { publicId: string } | null }>;
    }>(await call(OWNER.token, '/portability/models'));
    expect(listed.models.find((each) => each.notebookId === notebookId)?.publication).toMatchObject(
      { publicId: model['publicId'] },
    );
  });

  it('refuses a stranger, and a notebook that is no model', async () => {
    const bare = await json<{ notebookId: string }>(
      await call(OWNER.token, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Sem modelo', description: '' },
      }),
    );
    expect((await publish(OWNER.token, bare.notebookId)).status).toBe(404);
    expect((await publish(STRANGER.token, notebookId)).status).toBe(404);
  });

  it('is found, read and created from by a stranger, and stays the author’s', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));

    // No account: the search, the model as it stands and its history, and nothing else.
    const found = await json<{ models: Array<{ publicId: string }> }>(
      await call(null, '/public/catalog?q=procurement&language=pt'),
    );
    expect(found.models.map((each) => each.publicId)).toEqual([publicId]);
    expect(
      (await json<{ models: unknown[] }>(await call(null, '/public/catalog?q=hospital'))).models,
    ).toEqual([]);
    const read = await call(null, `/public/catalog/${publicId}`);
    expect(read.status).toBe(200);
    expect(read.headers.get('cache-control')).toContain('max-age=');
    // The edge answers what it holds while it asks for a fresh one (#420).
    expect(read.headers.get('cache-control')).toContain('stale-while-revalidate=');
    const contents = await json<{ notes: Array<{ body: string }> }>(
      await call(null, `/public/catalog/${publicId}/contents`),
    );
    expect(contents.notes[0]?.body).toContain('{{orgao}}');
    const history = await json<{ changes: Array<Record<string, unknown>> }>(
      await call(null, `/public/catalog/${publicId}/history`),
    );
    // When and what, never who: no connector, no person (#431).
    for (const change of history.changes) expect(change).not.toHaveProperty('agent');
    expect((await call(null, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(STRANGER.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(STRANGER.token, `/portability/models/${notebookId}`)).status).toBe(404);

    // Signed in, a notebook of their own, filled in, in their own subscription.
    expect(
      (
        await call(null, `/portability/catalog/${publicId}/notebooks`, {
          method: 'POST',
          body: { values: { orgao: 'Prefeitura' } },
        })
      ).status,
      // Without a session nothing is written, and the answer is the one of a refusal.
    ).toBe(404);
    const created = await call(STRANGER.token, `/portability/catalog/${publicId}/notebooks`, {
      method: 'POST',
      body: { values: { orgao: 'Prefeitura' } },
    });
    expect(created.status).toBe(202);
    const mine = await json<Array<{ notebookId: string; name: string }>>(
      await call(STRANGER.token, '/knowledge/notebooks'),
    );
    expect(mine.map((each) => each.name)).toEqual(['Licitações Prefeitura']);

    // A model derived from it is published without crediting the original,
    // which stays as it was.
    const derivedId = mine[0]?.notebookId ?? '';
    await named(STRANGER.email, 'Bruno Costa');
    await call(STRANGER.token, `/portability/models/${derivedId}`, {
      method: 'PUT',
      body: { objective: 'Follow the procurement of a city hall', basedOn: null },
    });
    expect((await publish(STRANGER.token, derivedId)).status).toBe(200);
    const both = await json<{ models: Array<{ author: string }> }>(
      await call(null, '/public/catalog'),
    );
    expect(both.models.map((each) => each.author).sort()).toEqual(['Ana Pereira', 'Bruno Costa']);
    // A page at a time, the newest published first (#432).
    const page = await json<{
      models: Array<{ author: string }>;
      next: string | null;
      total: number;
    }>(await call(null, '/public/catalog?limit=1'));
    expect(page.models.map((each) => each.author)).toEqual(['Bruno Costa']);
    expect(page.total).toBe(2);
    const rest = await json<{ models: Array<{ author: string }>; next: string | null }>(
      await call(null, `/public/catalog?limit=1&cursor=${page.next ?? ''}`),
    );
    expect(rest.models.map((each) => each.author)).toEqual(['Ana Pereira']);
    expect(rest.next).toBeNull();
    expect((await call(null, '/public/catalog?limit=500')).status).toBe(400);
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(200);

    // Withdrawn by its owner: gone from the catalog, the stranger's notebook untouched.
    expect(
      (
        await call(OWNER.token, `/portability/models/${notebookId}/publication`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204);
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(404);
    expect((await call(null, `/public/catalog/${publicId}/contents`)).status).toBe(404);
    expect((await call(null, `/public/catalog/${publicId}/history`)).status).toBe(404);
    const still = await json<Array<{ name: string }>>(
      await call(STRANGER.token, '/knowledge/notebooks'),
    );
    expect(still.map((each) => each.name)).toContain('Licitações Prefeitura');
  });

  it('reaches the catalog with every change its owner makes, with nothing published again (#431)', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));
    const { folderId } = (
      await json<{ folders: Array<{ folderId: string }> }>(
        await call(null, `/public/catalog/${publicId}/contents`),
      )
    ).folders[0]!;
    await call(OWNER.token, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '---\nname: Contrato de exemplo\n---\n\nAssinado.\n' },
    });
    await call(OWNER.token, `/portability/models/${notebookId}`, {
      method: 'PUT',
      body: {
        objective: 'Follow the procurement and the contracts of one public body',
        parameters: [
          { name: 'orgao', description: 'The public body', type: 'text', required: true },
        ],
      },
    });

    const contents = await json<{ notes: unknown[]; objective: string }>(
      await call(null, `/public/catalog/${publicId}/contents`),
    );
    expect(contents.notes).toHaveLength(2);
    expect(contents.objective).toBe('Follow the procurement and the contracts of one public body');
    const model = await json<{ objective: string }>(
      await call(null, `/public/catalog/${publicId}`),
    );
    expect(model.objective).toBe('Follow the procurement and the contracts of one public body');
  });

  it('hides the models of a subscription that grants no access', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));
    await call(OPERATOR, `/access/platform/subscriptions/${ownerSubscription}/suspend`, {
      method: 'POST',
      body: {},
    });
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(404);
    expect((await json<{ models: unknown[] }>(await call(null, '/public/catalog'))).models).toEqual(
      [],
    );
  });

  it('takes no report and has no withdrawal of the operator (#439)', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));
    expect(
      (
        await call(STRANGER.token, `/portability/catalog/${publicId}/reports`, {
          method: 'POST',
          body: { reason: 'Copied from somebody else' },
        })
      ).status,
    ).toBe(404);
    expect((await call(OPERATOR, '/platform/catalog/reports')).status).toBe(404);
    expect(
      (
        await call(OPERATOR, `/platform/catalog/models/${publicId}/withdraw`, {
          method: 'POST',
          body: { reason: 'Moderation' },
        })
      ).status,
    ).toBe(404);
    // Only its author withdraws it.
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(200);
  });
});
