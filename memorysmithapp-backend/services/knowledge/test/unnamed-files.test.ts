/**
 * Which bytes under `f/` no file names (#377): only what is older than a keep
 * in flight, never what an item names, and nothing but identifiers and sizes.
 */

import { describe, expect, it } from 'vitest';
import { ContentId, SubscriptionId } from '@memorysmithapp/kernel';
import { unnamedAmong } from '../src/adapters/inbound/unnamed-files.js';

const subscription = SubscriptionId.generate().value;
const now = new Date('2026-11-08T12:00:00Z');
const cutoff = new Date(now.getTime() - 24 * 3_600_000);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

describe('the bytes of a file nothing names', () => {
  const orphan = ContentId.generate().value;
  const kept = ContentId.generate().value;
  const inFlight = ContentId.generate().value;
  const objects = [
    { key: `s/${subscription}/f/${orphan}`, bytes: 5_526_617, lastModified: hoursAgo(48) },
    { key: `s/${subscription}/f/${kept}`, bytes: 10, lastModified: hoursAgo(48) },
    { key: `s/${subscription}/f/${inFlight}`, bytes: 20, lastModified: hoursAgo(1) },
    {
      key: `s/${subscription}/c/${ContentId.generate().value}.md`,
      bytes: 30,
      lastModified: hoursAgo(48),
    },
    { key: `s/${subscription}/uploads/whatever`, bytes: 40, lastModified: hoursAgo(48) },
  ];
  const found = unnamedAmong(objects, new Set([`${subscription}/${kept}`]), cutoff);

  it('chooses an object under f/ older than the safety age that no item names', () => {
    expect(found).toEqual([
      {
        subscriptionId: subscription,
        contentId: orphan,
        bytes: 5_526_617,
        lastModified: hoursAgo(48).toISOString(),
      },
    ]);
  });

  it('never chooses an object an item names', () => {
    expect(found.map((file) => file.contentId)).not.toContain(kept);
  });

  it('never chooses an object younger than the safety age, a keep in flight', () => {
    expect(found.map((file) => file.contentId)).not.toContain(inFlight);
  });

  it('reads only the bytes of files, never a note, an upload or a key of another shape', () => {
    expect(
      unnamedAmong(
        [{ key: `s/${subscription}/f/not-an-id`, bytes: 1, lastModified: hoursAgo(48) }],
        new Set(),
        cutoff,
      ),
    ).toEqual([]);
  });
});
