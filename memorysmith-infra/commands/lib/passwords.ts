/**
 * A password nobody is meant to keep: a command signs in with it while it runs
 * and replaces it at the end. Letters and digits only, one of each kind first
 * so the pool policy is met by construction and not by luck, then shuffled so
 * their positions say nothing, and long enough that the alphabet costs nothing.
 */

import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';

const pick = (alphabet: string): string => alphabet.charAt(randomInt(alphabet.length));

export function workingPassword(length = 24): string {
  const characters = [pick(UPPER), pick(LOWER), pick(DIGIT)];
  while (characters.length < length) characters.push(pick(UPPER + LOWER + DIGIT));
  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [characters[index], characters[other]] = [characters[other] ?? '', characters[index] ?? ''];
  }
  return characters.join('');
}
