/**
 * A notebook model shared with a person of another subscription (#355): as a
 * model reader, who reads the model and its versions and creates notebooks
 * from them without ever reaching the notebook, or through a share of the
 * notebook itself, whose profile decides what they may edit. Every
 * distribution of a model is under CC0 1.0, which its owner accepts once
 * (#357), and nothing of it moves storage.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { UserId } from '@memorysmithapp/kernel';
import { Email } from '@memorysmithapp/svc-access/domain/values';
import { buildTestApp } from './wiring.js';

type App = ReturnType<typeof buildTestApp>;

let harness: App;
let notebookId: string;
let folderId: string;

const OWNER = { token: 'token-owner', sub: 'user-owner', email: 'owner@example.com' };
const GRANTEE = { token: 'token-grantee', sub: 'user-grantee', email: 'grantee@example.com' };

async function call(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return harness.app.request(path, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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
  harness.verifier.issue('platform-token', {
    sub: 'platform-admin',
    email: 'admin@memorysmith.app',
    groups: ['platform-admin'],
  });
  await call('platform-token', `/access/platform/subscriptions/${subscriptionId}/approve`, {
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

function share(profile: string, acceptLicence?: boolean): Promise<Response> {
  return call(OWNER.token, `/access/notebooks/${notebookId}/shares`, {
    method: 'POST',
    body: { email: GRANTEE.email, profile, ...(acceptLicence ? { acceptLicence } : {}) },
  });
}

async function accept(): Promise<void> {
  expect(
    (await call(GRANTEE.token, `/access/shared/${notebookId}/accept`, { method: 'POST' })).status,
  ).toBe(204);
}

async function declareWithVersion(): Promise<void> {
  expect(
    (
      await call(OWNER.token, `/portability/models/${notebookId}`, {
        method: 'PUT',
        body: {
          objective: 'Run the assemblies of one condominium',
          parameters: [
            {
              name: 'condominio',
              description: 'The name of the condominium',
              example: 'Residencial Aurora',
              type: 'text',
              required: true,
            },
          ],
        },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(OWNER.token, `/portability/models/${notebookId}/versions`, {
        method: 'POST',
        body: { changelog: 'The first version' },
      })
    ).status,
  ).toBe(202);
}

/** The versions the owner keeps, as the count of their storage sees them. */
async function ownerVersions(): Promise<number> {
  const model = await json<{ versions: unknown[] }>(
    await call(OWNER.token, `/portability/models/${notebookId}`),
  );
  return model.versions.length;
}

beforeEach(async () => {
  harness = buildTestApp();
  await onboard(OWNER);
  await onboard(GRANTEE);
  notebookId = (
    await json<{ notebookId: string }>(
      await call(OWNER.token, '/knowledge/notebooks', {
        method: 'POST',
        body: { name: 'Condomínio {{condominio}}', description: 'Assembleias e obras' },
      }),
    )
  ).notebookId;
  folderId = (
    await json<{ folderId: string }>(
      await call(OWNER.token, `/knowledge/notebooks/${notebookId}/folders`, {
        method: 'POST',
        body: { name: 'Assembleias', description: 'Uma ata por assembleia.' },
      }),
    )
  ).folderId;
  await call(OWNER.token, `/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: { folderId, content: '---\nname: Ata de exemplo\n---\n\nAta de {{condominio}}.\n' },
  });
});

describe('sharing a notebook model (#355)', () => {
  it('offers the model reader only for a notebook declared as a model', async () => {
    const refused = await share('model-reader');
    expect(refused.status).toBe(400);
  });

  it('distributes a model under CC0 1.0, which its owner accepts once', async () => {
    await declareWithVersion();

    const unaccepted = await share('model-reader');
    expect(unaccepted.status).toBe(409);
    expect((await json<{ details?: { reason?: string } }>(unaccepted)).details?.reason).toBe(
      'LICENCE',
    );
    const before = await json<{ licence: string | null }>(
      await call(OWNER.token, `/portability/models/${notebookId}`),
    );
    expect(before.licence).toBeNull();

    expect((await share('model-reader', true)).status).toBe(204);
    const after = await json<{ licence: string | null }>(
      await call(OWNER.token, `/portability/models/${notebookId}`),
    );
    expect(after.licence).toBe('CC0-1.0');

    // Accepted once: the next distribution asks nothing.
    const changed = await call(
      OWNER.token,
      `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}/profile`,
      { method: 'PUT', body: { profile: 'reader' } },
    );
    expect(changed.status).toBe(204);
  });

  it('lets a model reader read the model and its versions, and never the notebook', async () => {
    await declareWithVersion();
    await share('model-reader', true);
    await accept();

    for (const path of [
      `/knowledge/notebooks/${notebookId}`,
      `/knowledge/notebooks/${notebookId}/notes`,
      `/discovery/notebooks/${notebookId}/graph`,
    ]) {
      expect((await call(GRANTEE.token, path)).status, path).toBe(404);
    }
    const exported = await call(GRANTEE.token, `/portability/notebooks/${notebookId}/export`, {
      method: 'POST',
      body: {},
    });
    expect(exported.status).toBe(404);

    const model = await call(GRANTEE.token, `/portability/models/${notebookId}`);
    expect(model.status).toBe(200);
    const read = await json<{ sharedBy: string | null; versions: Array<{ number: number }> }>(
      model,
    );
    expect(read.sharedBy).toBe(OWNER.email);
    expect(read.versions.map((each) => each.number)).toEqual([1]);

    const version = await call(GRANTEE.token, `/portability/models/${notebookId}/versions/1`);
    expect(version.status).toBe(200);

    const listed = await json<{ models: Array<{ notebookId: string; sharedBy: string | null }> }>(
      await call(GRANTEE.token, '/portability/models'),
    );
    expect(listed.models).toEqual([expect.objectContaining({ notebookId, sharedBy: OWNER.email })]);

    // Versioning and declaring stay with the owner, in the owner's subscription.
    expect(
      (
        await call(GRANTEE.token, `/portability/models/${notebookId}/versions`, {
          method: 'POST',
          body: { changelog: 'Mine' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(GRANTEE.token, `/portability/models/${notebookId}/versions/1`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(404);
  });

  it('creates the notebook in the subscription of the model reader, and moves nothing of the owner', async () => {
    await declareWithVersion();
    await share('model-reader', true);
    await accept();
    const versions = await ownerVersions();

    const created = await call(
      GRANTEE.token,
      `/portability/models/${notebookId}/versions/1/notebooks`,
      { method: 'POST', body: { values: { condominio: 'Aurora' } } },
    );
    expect(created.status).toBe(202);

    const mine = await json<Array<{ notebookId: string; name: string }>>(
      await call(GRANTEE.token, '/knowledge/notebooks'),
    );
    expect(mine.map((each) => each.name)).toEqual(['Condomínio Aurora']);
    const theirs = await json<Array<{ notebookId: string }>>(
      await call(OWNER.token, '/knowledge/notebooks'),
    );
    expect(theirs.map((each) => each.notebookId)).toEqual([notebookId]);
    expect(await ownerVersions()).toBe(versions);
  });

  it('lets a notebook editor edit the model notebook, and leaves versions to the owner', async () => {
    await declareWithVersion();
    await share('notebook-editor', true);
    await accept();

    const wrote = await call(GRANTEE.token, `/knowledge/notebooks/${notebookId}/notes`, {
      method: 'POST',
      body: { folderId, content: '---\nname: Outra ata\n---\n\nDe {{condominio}}.\n' },
    });
    expect(wrote.status).toBe(201);
    expect((await call(GRANTEE.token, `/portability/models/${notebookId}`)).status).toBe(200);
    expect(
      (
        await call(GRANTEE.token, `/portability/models/${notebookId}/versions`, {
          method: 'POST',
          body: { changelog: 'Mine' },
        })
      ).status,
    ).toBe(404);
  });

  it('closes the model with the share', async () => {
    await declareWithVersion();
    await share('model-reader', true);
    await accept();
    expect(
      (
        await call(OWNER.token, `/access/notebooks/${notebookId}/shares/${GRANTEE.sub}`, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204);
    expect((await call(GRANTEE.token, `/portability/models/${notebookId}`)).status).toBe(404);
    expect(
      (await json<{ models: unknown[] }>(await call(GRANTEE.token, '/portability/models'))).models,
    ).toEqual([]);
  });
});
