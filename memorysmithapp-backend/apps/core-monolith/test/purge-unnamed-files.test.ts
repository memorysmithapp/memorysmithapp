/**
 * The job that hands the purge the bytes no file names (#377): its safety age
 * and what it tells the purge.
 */

import { describe, expect, it } from 'vitest';
import { envelopeOf, olderThanOf } from '../src/purge-unnamed-files.js';

describe('purge-unnamed-files', () => {
  it('waits 24 hours unless told otherwise, and refuses an age that is not one', () => {
    expect(olderThanOf([])).toBe(24);
    expect(olderThanOf(['--older-than', '0', '--apply'])).toBe(0);
    expect(() => olderThanOf(['--older-than', 'soon'])).toThrow('number of hours');
  });

  it('hands the purge the subscription and the content, and nothing that names a file', () => {
    expect(
      envelopeOf({ subscriptionId: 'sub', contentId: 'content', bytes: 9, lastModified: 'x' }),
    ).toEqual({
      type: 'FileUnnamed',
      subscriptionId: 'sub',
      authorship: null,
      contentRef: null,
      payload: { contentId: 'content' },
    });
  });
});
