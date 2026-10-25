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

/** A model with a parameter and one ready version, in the subscription of a token. */
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
  await call(token, `/portability/models/${id}/versions`, {
    method: 'POST',
    body: { changelog: 'The first version' },
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
  });

  it('refuses a member and a model with no ready version', async () => {
    const bare = await json<{ notebookId: string }>(
      await call(OWNER.token, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Sem versão', description: '' },
      }),
    );
    await call(OWNER.token, `/portability/models/${bare.notebookId}`, {
      method: 'PUT',
      body: { objective: 'Nothing yet' },
    });
    expect((await publish(OWNER.token, bare.notebookId)).status).toBe(409);
    expect((await publish(STRANGER.token, notebookId)).status).toBe(404);
  });

  it('is found, read and created from by a stranger, and stays the author’s', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));

    // No account: the search, the model and its versions, and nothing else.
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
    const version = await json<{ notes: Array<{ body: string }> }>(
      await call(null, `/public/catalog/${publicId}/versions/1`),
    );
    expect(version.notes[0]?.body).toContain('{{orgao}}');
    expect((await call(null, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(STRANGER.token, `/knowledge/notebooks/${notebookId}`)).status).toBe(404);
    expect((await call(STRANGER.token, `/portability/models/${notebookId}`)).status).toBe(404);

    // Signed in, a notebook of their own, filled in, in their own subscription.
    expect(
      (
        await call(null, `/portability/catalog/${publicId}/versions/1/notebooks`, {
          method: 'POST',
          body: { values: { orgao: 'Prefeitura' } },
        })
      ).status,
      // Without a session nothing is written, and the answer is the one of a refusal.
    ).toBe(404);
    const created = await call(
      STRANGER.token,
      `/portability/catalog/${publicId}/versions/1/notebooks`,
      { method: 'POST', body: { values: { orgao: 'Prefeitura' } } },
    );
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
    await call(STRANGER.token, `/portability/models/${derivedId}/versions`, {
      method: 'POST',
      body: { changelog: 'Derived' },
    });
    expect((await publish(STRANGER.token, derivedId)).status).toBe(200);
    const both = await json<{ models: Array<{ author: string }> }>(
      await call(null, '/public/catalog'),
    );
    expect(both.models.map((each) => each.author).sort()).toEqual(['Ana Pereira', 'Bruno Costa']);
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
    expect((await call(null, `/public/catalog/${publicId}/versions/1`)).status).toBe(404);
    const still = await json<Array<{ name: string }>>(
      await call(STRANGER.token, '/knowledge/notebooks'),
    );
    expect(still.map((each) => each.name)).toContain('Licitações Prefeitura');
  });

  it('follows the versions the author retains, and withdraws a model left with none', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));
    await call(OWNER.token, `/portability/models/${notebookId}/versions`, {
      method: 'POST',
      body: { changelog: 'Contracts' },
    });
    // A version made ready joins the entry, with nothing published again.
    const two = await json<{ versions: Array<{ number: number }> }>(
      await call(null, `/public/catalog/${publicId}`),
    );
    expect(two.versions.map((each) => each.number)).toEqual([2, 1]);

    await call(OWNER.token, `/portability/models/${notebookId}/versions/2`, { method: 'DELETE' });
    const one = await json<{ versions: Array<{ number: number }> }>(
      await call(null, `/public/catalog/${publicId}`),
    );
    expect(one.versions.map((each) => each.number)).toEqual([1]);

    await call(OWNER.token, `/portability/models/${notebookId}/versions/1`, { method: 'DELETE' });
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(404);
    const model = await json<{ publication: unknown }>(
      await call(OWNER.token, `/portability/models/${notebookId}`),
    );
    expect(model.publication).toBeNull();
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

  it('takes a report only from a person signed in, which the operator acts on', async () => {
    const { publicId } = await json<{ publicId: string }>(await publish(OWNER.token, notebookId));
    expect(
      (
        await call(null, `/portability/catalog/${publicId}/reports`, {
          method: 'POST',
          body: { reason: 'Copied from somebody else' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(STRANGER.token, `/portability/catalog/${publicId}/reports`, {
          method: 'POST',
          body: { reason: 'Copied from somebody else' },
        })
      ).status,
    ).toBe(204);

    // Nobody but the operator reads the reports.
    expect((await call(OWNER.token, '/platform/catalog/reports')).status).toBe(404);
    const { reports } = await json<{
      reports: Array<{ reportId: string; publicId: string; reason: string }>;
    }>(await call(OPERATOR, '/platform/catalog/reports'));
    expect(reports).toEqual([
      expect.objectContaining({ publicId, reason: 'Copied from somebody else' }),
    ]);

    const withdrawn = await call(OPERATOR, `/platform/catalog/models/${publicId}/withdraw`, {
      method: 'POST',
      body: { reason: 'It copies a model of another author' },
    });
    expect(withdrawn.status).toBe(204);
    expect((await call(null, `/public/catalog/${publicId}`)).status).toBe(404);
    expect(harness.authorMail).toEqual([
      expect.objectContaining({ to: OWNER.email, reason: 'It copies a model of another author' }),
    ]);
    // The model and its versions stay with the author, untouched (INV-12).
    const model = await json<{ versions: unknown[]; publication: unknown }>(
      await call(OWNER.token, `/portability/models/${notebookId}`),
    );
    expect(model.versions).toHaveLength(1);
    expect(model.publication).toBeNull();

    expect(
      (
        await call(OPERATOR, `/platform/catalog/reports/${reports[0]?.reportId ?? ''}`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204);
    expect(
      (await json<{ reports: unknown[] }>(await call(OPERATOR, '/platform/catalog/reports')))
        .reports,
    ).toEqual([]);
  });
});
