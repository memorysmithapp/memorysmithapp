/**
 * The community catalog (#360), against the deployed environment: a model
 * published by the owner of the second subscription of the run, found and read
 * with no account, created from by the owner of the first, and withdrawn by its
 * author, the one who withdraws a model (#439).
 */

import { randomBytes } from 'node:crypto';
import { eventually } from '../support/eventually.js';
import type { Api } from '../support/api.js';
import { expect, test } from './fixtures.js';

interface PublicModel {
  publicId: string;
  name: string;
  author: string;
  licence: string;
}

/** A notebook of the publisher declared as a model. */
async function modelOf(publisher: Api, name: string): Promise<string> {
  const { notebookId } = await publisher.ok<{ notebookId: string }>(
    'POST',
    '/knowledge/notebooks',
    { name, description: 'A model of a functional case, for {{team}}' },
  );
  const { folderId } = await publisher.ok<{ folderId: string }>(
    'POST',
    `/knowledge/notebooks/${notebookId}/folders`,
    { name: 'Findings', description: 'One finding per note.' },
  );
  await publisher.ok('POST', `/knowledge/notebooks/${notebookId}/notes`, {
    folderId,
    content: '---\nname: An example finding\n---\n\nFound by {{team}}.\n',
  });
  await publisher.ok('PUT', `/portability/models/${notebookId}`, {
    objective: 'Keep the findings of one team',
    parameters: [{ name: 'team', description: 'The team', type: 'text', required: true }],
  });
  return notebookId;
}

test.describe('the community catalog', () => {
  test('[route:PUT /portability/models/:v/publication] [route:GET /public/catalog] [route:GET /public/catalog/:p] [route:GET /public/catalog/:p/contents] [route:GET /public/catalog/:p/history] [route:POST /portability/catalog/:p/notebooks] [route:DELETE /portability/models/:v/publication] publishes a model, which anybody finds and reads as it stands and a person signed in creates from, and withdraws it', async ({
    other,
    owner,
    anonymous,
  }) => {
    const marker = `catalog${randomBytes(4).toString('hex')}`;
    await other.ok('PUT', '/access/profile', { name: 'Functional Author', avatar: 'initials' });
    const notebookId = await modelOf(other, `Findings ${marker}`);
    let created: string | null = null;

    try {
      const published = await other.ok<PublicModel>(
        'PUT',
        `/portability/models/${notebookId}/publication`,
        { language: 'en', acceptLicence: true },
      );
      expect(published).toMatchObject({ author: 'Functional Author', licence: 'CC0-1.0' });

      // No account: found by a word of its name, read whole as it stands, with its history.
      const found = await eventually(
        'the model to be found',
        () => anonymous.ok<{ models: PublicModel[] }>('GET', `/public/catalog?q=${marker}`),
        (answer) => answer.models.length > 0,
      );
      expect(found.models.map((each) => each.publicId)).toEqual([published.publicId]);
      const read = await anonymous.call<PublicModel>(
        'GET',
        `/public/catalog/${published.publicId}`,
      );
      expect(read.status).toBe(200);
      expect(JSON.stringify(read.body)).not.toContain('@');
      const contents = await anonymous.ok<{ notes: Array<{ body: string }> }>(
        'GET',
        `/public/catalog/${published.publicId}/contents`,
      );
      expect(contents.notes[0]?.body).toContain('{{team}}');
      // When and what changed, never who (#431).
      const history = await anonymous.ok<{ changes: Array<Record<string, unknown>> }>(
        'GET',
        `/public/catalog/${published.publicId}/history`,
      );
      for (const change of history.changes) expect(change).not.toHaveProperty('agent');
      expect(JSON.stringify(history)).not.toContain('@');

      // Signed in, a notebook of the creator's own subscription.
      const started = await owner.call<{ transferId: string }>(
        'POST',
        `/portability/catalog/${published.publicId}/notebooks`,
        { name: `From the catalog ${marker}`, values: { team: 'Functional' } },
      );
      expect(started.status).toBe(202);
      const transfer = await eventually(
        'the notebook to be created',
        () =>
          owner.ok<{ status: string; notebookId: string | null }>(
            'GET',
            `/portability/transfers/${started.body.transferId}`,
          ),
        (each) => each.status !== 'running',
        { timeoutMs: 120_000 },
      );
      expect(transfer.status).toBe('ready');
      created = transfer.notebookId;

      expect(
        (await other.call('DELETE', `/portability/models/${notebookId}/publication`)).status,
      ).toBe(204);
      // The route answers past the edge here, which a withdrawal empties.
      expect((await anonymous.call('GET', `/public/catalog/${published.publicId}`)).status).toBe(
        404,
      );
      if (created) {
        expect((await owner.call('GET', `/knowledge/notebooks/${created}`)).status).toBe(200);
      }
    } finally {
      if (created) await owner.call('DELETE', `/knowledge/notebooks/${created}`);
      await other.call('DELETE', `/knowledge/notebooks/${notebookId}`);
    }
  });
});
