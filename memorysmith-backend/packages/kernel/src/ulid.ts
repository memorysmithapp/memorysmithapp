/**
 * ULID: a 26-character, lexicographically sortable identifier
 * (48-bit timestamp + 80 bits of randomness, Crockford base32).
 *
 * Implemented here rather than pulled from a dependency because the kernel is
 * the one package every service imports, and because sortability is a property
 * the key design relies on: event ULIDs in the outbox and the audit sort keys
 * are ordered by generation time (architecture-guide.md, sections 10.4, 12.2).
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const ENCODING_LENGTH = 32;
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
const MAX_TIME = 281_474_976_710_655; // 2^48 - 1

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(time: number): string {
  let out = '';
  for (let index = TIME_LENGTH - 1; index >= 0; index--) {
    const mod = time % ENCODING_LENGTH;
    out = ENCODING[mod] + out;
    time = (time - mod) / ENCODING_LENGTH;
  }
  return out;
}

function randomDigits(): number[] {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte % ENCODING_LENGTH);
}

/**
 * Increments the random part so that two ULIDs minted inside the same
 * millisecond still sort in generation order.
 */
function incrementDigits(digits: number[]): number[] {
  const next = [...digits];
  for (let index = next.length - 1; index >= 0; index--) {
    const digit = next[index] ?? 0;
    if (digit < ENCODING_LENGTH - 1) {
      next[index] = digit + 1;
      return next;
    }
    next[index] = 0;
  }
  // Overflowed a whole millisecond of randomness: start over.
  return randomDigits();
}

export function ulid(now: number = Date.now()): string {
  if (!Number.isInteger(now) || now < 0 || now > MAX_TIME) {
    throw new RangeError(`Timestamp out of ULID range: ${now}`);
  }
  const digits = now === lastTime ? incrementDigits(lastRandom) : randomDigits();
  lastTime = now;
  lastRandom = digits;
  return encodeTime(now) + digits.map((digit) => ENCODING[digit]).join('');
}

export function isUlid(candidate: string): boolean {
  return ULID_PATTERN.test(candidate);
}

/** The generation instant encoded in the identifier, in epoch milliseconds. */
export function ulidTime(value: string): number {
  return value
    .slice(0, TIME_LENGTH)
    .split('')
    .reduce((time, char) => time * ENCODING_LENGTH + ENCODING.indexOf(char), 0);
}
