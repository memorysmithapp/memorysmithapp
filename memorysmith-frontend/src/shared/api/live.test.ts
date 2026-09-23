/**
 * A read never lands while a write of the page is waiting or in flight (#206):
 * between a tick and its write it would take the tick off the screen and base
 * the next write on a revision the person never saw.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { useWriteStatus } from '../store/write-status';
import { mayRefetch } from './live';

afterEach(() => useWriteStatus.getState().clear());

describe('what is on the screen follows what somebody else wrote', () => {
  it('reads again when nothing of this page is being written', () => {
    expect(mayRefetch()).toBe(true);
  });

  it('waits while a change is on screen and not sent yet', () => {
    useWriteStatus.getState().changed();
    expect(mayRefetch()).toBe(false);
  });

  it('waits while the write is in flight', () => {
    useWriteStatus.getState().saving();
    expect(mayRefetch()).toBe(false);
  });

  it('reads again once the write landed, or failed', () => {
    useWriteStatus.getState().saved();
    expect(mayRefetch()).toBe(true);
    useWriteStatus.getState().failed('errors.unexpected');
    expect(mayRefetch()).toBe(true);
  });
});
