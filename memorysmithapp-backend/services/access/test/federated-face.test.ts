/**
 * The face of a federated person, taken again on every sign-in from the
 * organization's directory (RN-ACC-046, #561), and the directory itself as
 * Microsoft Graph answers it.
 */

import { describe, expect, it } from 'vitest';
import { SubscriptionContext, UserId } from '@memorysmithapp/kernel';
import { RefreshFederatedFace, type DirectoryAnswer } from '../src/application/federated-face.js';
import { GraphDirectoryPictures } from '../src/adapters/outbound/graph/GraphDirectoryPictures.js';
import {
  InMemoryAccessDatabase,
  InMemoryAvatarRepository,
} from '../src/adapters/outbound/memory/InMemoryAccess.js';
import type { MemberAvatar } from '../src/domain/ports/index.js';
import { AvatarSource, Email } from '../src/domain/values.js';

/** A PNG as its first bytes say, which is all `supports` reads in these tests. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const OTHER_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

const need = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) throw new Error('A value of the test was refused');
  return result.value;
};
const person = need(UserId.create('user-1'));
const email = need(Email.create('ana@acme.example'));

function setUp(answer: DirectoryAnswer | 'no directory', held?: MemberAvatar) {
  const db = new InMemoryAccessDatabase();
  const context = need(
    SubscriptionContext.fromClaims({
      sub: person.value,
      subscription_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      subscription_status: 'active',
    }),
  );
  const avatars = new InMemoryAvatarRepository(context, db);
  const asked: string[] = [];
  const refresh = new RefreshFederatedFace(
    avatars,
    answer === 'no directory'
      ? null
      : {
          pictureOf: async (address) => {
            asked.push(address.value);
            return answer;
          },
        },
    {
      accepted: ['image/png', 'image/jpeg', 'image/webp'],
      supports: (mime, bytes) => mime === 'image/png' && bytes[0] === 0x89,
    },
  );
  const face = async () => {
    if (held) await avatars.save(person, held);
    await refresh.execute({ person, email });
    return avatars.find(person);
  };
  return { asked, face };
}

const upload = (bytes: Uint8Array): MemberAvatar => ({
  source: AvatarSource.UPLOAD,
  picture: bytes,
  mime: 'image/png',
});
const initials: MemberAvatar = { source: AvatarSource.INITIALS, picture: null, mime: null };
const gravatar: MemberAvatar = { source: AvatarSource.GRAVATAR, picture: null, mime: null };

describe('the face of a federated person, on every sign-in (RN-ACC-046, #561)', () => {
  it("keeps the picture of the organization's directory, asked by the address", async () => {
    const { asked, face } = setUp({ kind: 'picture', picture: { mime: 'image/png', bytes: PNG } });

    const kept = await face();

    expect(asked).toEqual(['ana@acme.example']);
    expect(kept?.source.name).toBe('upload');
    expect(kept?.picture).toEqual(PNG);
  });

  it('follows a photo changed in the directory', async () => {
    const { face } = setUp(
      { kind: 'picture', picture: { mime: 'image/png', bytes: OTHER_PNG } },
      upload(PNG),
    );

    expect((await face())?.picture).toEqual(OTHER_PNG);
  });

  it('follows a photo removed from the directory, to the initials', async () => {
    const { face } = setUp({ kind: 'none' }, upload(PNG));

    expect(await face()).toEqual(initials);
  });

  it('keeps the photo it had when the directory cannot be asked', async () => {
    const { face } = setUp({ kind: 'unknown' }, upload(PNG));

    expect((await face())?.picture).toEqual(PNG);
  });

  it('gives the initials, never Gravatar, to a person with nothing the directory gave', async () => {
    expect(await setUp({ kind: 'unknown' }).face()).toEqual(initials);
    expect(await setUp({ kind: 'unknown' }, gravatar).face()).toEqual(initials);
    expect(await setUp('no directory').face()).toEqual(initials);
  });

  it('refuses a picture too large, of a type not kept, or whose bytes say otherwise', async () => {
    for (const picture of [
      { mime: 'image/png', bytes: new Uint8Array(64 * 1024 + 1).fill(0x89) },
      { mime: 'image/gif', bytes: PNG },
      { mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
      { mime: 'image/png', bytes: new Uint8Array() },
    ]) {
      expect(await setUp({ kind: 'picture', picture }, upload(PNG)).face()).toEqual(initials);
    }
  });
});

describe('the photo Microsoft Graph keeps, asked with the app credential (#561)', () => {
  type Call = { url: string; init: RequestInit | undefined };

  function graph(answers: Array<() => Response>) {
    const calls: Call[] = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const answer = answers.shift();
      if (!answer) throw new Error(`Nothing answers ${String(url)}`);
      return answer();
    }) as typeof fetch;
    const pictures = new GraphDirectoryPictures(
      { tenant: 'tenant-1', clientId: 'client-1', secret: async () => 's3cret' },
      2000,
      fetchFn,
    );
    return { calls, pictures };
  }
  const token = () => Response.json({ access_token: 'graph-token' });

  it('asks for a token by client credentials, then the photo by the address', async () => {
    const { calls, pictures } = graph([
      token,
      () => new Response(PNG, { headers: { 'content-type': 'image/png' } }),
    ]);

    expect(await pictures.pictureOf(email)).toEqual({
      kind: 'picture',
      picture: { mime: 'image/png', bytes: PNG },
    });
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

    const found = await pictures.pictureOf(email);

    expect(found.kind === 'picture' && found.picture.mime).toBe('image/jpeg');
    expect(calls[2]?.url).toBe(
      'https://graph.microsoft.com/v1.0/users/ana%40acme.example/photo/$value',
    );
  });

  it('says the person has none only when both answer 404', async () => {
    const { pictures } = graph([
      token,
      () => new Response(null, { status: 404 }),
      () => new Response(null, { status: 404 }),
    ]);

    expect(await pictures.pictureOf(email)).toEqual({ kind: 'none' });
  });

  it('answers unknown, without retrying, when Graph refuses, as it does without the permission', async () => {
    const { calls, pictures } = graph([token, () => new Response(null, { status: 401 })]);

    expect(await pictures.pictureOf(email)).toEqual({ kind: 'unknown' });
    expect(calls).toHaveLength(2);
  });

  it('answers unknown when no token is given, or anything throws', async () => {
    expect(
      await graph([() => new Response('{}', { status: 401 })]).pictures.pictureOf(email),
    ).toEqual({ kind: 'unknown' });
    expect(
      await graph([
        () => {
          throw new Error('network');
        },
      ]).pictures.pictureOf(email),
    ).toEqual({ kind: 'unknown' });
  });
});
