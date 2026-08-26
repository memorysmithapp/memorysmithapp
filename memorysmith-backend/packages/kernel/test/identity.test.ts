import { describe, expect, it } from 'vitest';
import { isUlid, ulid, ulidTime } from '../src/ulid.js';
import { ContentId, NoteId, SubscriptionId, UserId, VaultId } from '../src/ids.js';
import { Slug, slugify } from '../src/slug.js';
import { SubscriptionContext } from '../src/subscription-context.js';
import { Instant } from '../src/instant.js';

describe('ulid', () => {
  it('generates 26-character Crockford base32 identifiers', () => {
    const value = ulid();
    expect(value).toHaveLength(26);
    expect(isUlid(value)).toBe(true);
  });

  it('sorts by generation time, including inside the same millisecond', () => {
    const now = Date.now();
    const batch = Array.from({ length: 200 }, () => ulid(now));
    expect([...batch].sort()).toEqual(batch);
    expect(new Set(batch).size).toBe(batch.length);
  });

  it('encodes the generation instant', () => {
    const now = Date.now();
    expect(ulidTime(ulid(now))).toBe(now);
  });

  it('rejects lookalikes that use the excluded letters', () => {
    expect(isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
    expect(isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI')).toBe(false); // I is not in the alphabet
    expect(isUlid('short')).toBe(false);
  });
});

describe('identifiers', () => {
  it('accepts a well-formed value and rejects everything else', () => {
    const generated = VaultId.generate();
    expect(VaultId.create(generated.value).ok).toBe(true);
    expect(VaultId.create('not-a-ulid').ok).toBe(false);
    expect(VaultId.create('').ok).toBe(false);
  });

  it('compares by value and never across types', () => {
    const raw = ulid();
    const asNote = NoteId.create(raw);
    const asContent = ContentId.create(raw);
    expect(asNote.ok && asContent.ok).toBe(true);
    if (!asNote.ok || !asContent.ok) return;
    expect(asNote.value.equals(NoteId.create(raw).ok ? asNote.value : null)).toBe(true);
    expect(asNote.value.equals(asContent.value)).toBe(false);
  });

  it('only lets a SubscriptionId in through the claim door', () => {
    const generated = SubscriptionId.generate();
    expect(SubscriptionId.fromClaim(generated.value).ok).toBe(true);
    expect(SubscriptionId.fromClaim('../../etc/passwd').ok).toBe(false);
  });

  it('treats a Cognito sub as a global identity', () => {
    expect(UserId.create('a1b2c3d4-1111-2222-3333-444455556666').ok).toBe(true);
    expect(UserId.create('').ok).toBe(false);
    expect(UserId.create('has space').ok).toBe(false);
  });
});

describe('Slug', () => {
  it('normalizes free text deterministically', () => {
    expect(slugify('Lei 14.133, art. 75')).toBe('lei-14-133-art-75');
    expect(slugify('  Normas e Legislacao  ')).toBe('normas-e-legislacao');
    expect(slugify('Aquisicao Publica')).toBe('aquisicao-publica');
    expect(slugify('Achado #12')).toBe('achado-12');
  });

  it('folds accents so the same title always yields the same slug', () => {
    expect(slugify('Legislacao')).toBe(slugify('Legislação'));
    expect(slugify('Orçamento Anúal')).toBe('orcamento-anual');
  });

  it('rejects a slug that is not already normalized', () => {
    expect(Slug.create('lei-14133').ok).toBe(true);
    expect(Slug.create('Lei-14133').ok).toBe(false);
    expect(Slug.create('lei--14133').ok).toBe(false);
    expect(Slug.create('-lei').ok).toBe(false);
    expect(Slug.create('').ok).toBe(false);
  });

  it('refuses text that normalizes to nothing', () => {
    expect(Slug.from('---').ok).toBe(false);
    expect(Slug.from('').ok).toBe(false);
  });
});

describe('SubscriptionContext', () => {
  const subscriptionId = SubscriptionId.generate().value;

  it('is built from the claims of a verified token', () => {
    const context = SubscriptionContext.fromClaims({
      sub: 'user-1',
      subscription_id: subscriptionId,
      subscription_status: 'active',
    });
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    expect(context.value.subscriptionId.value).toBe(subscriptionId);
    expect(context.value.grantsOperationalAccess).toBe(true);
  });

  it('cannot be built by a platform session, which carries no subscription claim', () => {
    const context = SubscriptionContext.fromClaims({ sub: 'platform-admin-1' });
    expect(context.ok).toBe(false);
    if (context.ok) return;
    // The failure is structural: no key can be built, and it is not a role check.
    expect(context.error.code).toBe('FORBIDDEN');
    expect(context.error.message).toContain('no subscription');
  });

  it('reports a suspended subscription as granting no operational access', () => {
    const context = SubscriptionContext.fromClaims({
      sub: 'user-1',
      subscription_id: subscriptionId,
      subscription_status: 'suspended',
    });
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    expect(context.value.grantsOperationalAccess).toBe(false);
  });
});

describe('Instant', () => {
  it('round-trips through ISO 8601', () => {
    const parsed = Instant.fromISO('2026-03-12T10:15:00.000Z');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.toISOString()).toBe('2026-03-12T10:15:00.000Z');
    expect(parsed.value.toEpochSeconds()).toBe(Date.parse('2026-03-12T10:15:00.000Z') / 1000);
  });

  it('orders two points in time', () => {
    const earlier = Instant.fromEpochMillis(1000);
    const later = Instant.fromEpochMillis(2000);
    expect(earlier.ok && later.ok).toBe(true);
    if (!earlier.ok || !later.ok) return;
    expect(earlier.value.isBefore(later.value)).toBe(true);
    expect(later.value.isAfter(earlier.value)).toBe(true);
    expect(earlier.value.isAtOrBefore(earlier.value)).toBe(true);
  });

  it('rejects garbage', () => {
    expect(Instant.fromISO('not a date').ok).toBe(false);
    expect(Instant.fromEpochMillis(-1).ok).toBe(false);
  });
});
