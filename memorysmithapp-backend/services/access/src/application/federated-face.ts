/**
 * The face of a person who signs in through the organization's identity
 * provider, taken again on every sign-in (RN-ACC-046, #561).
 *
 * Such an account has no profile in MemorySmith: its picture is the one the
 * organization's directory keeps, so a photo changed or removed there reaches
 * MemorySmith on the person's next sign-in. A directory that cannot be asked
 * (no permission, no answer in time) changes nothing it already gave, and a
 * person with nothing yet gets their initials, never Gravatar, which would
 * send gravatar.com the hash of a corporate address (RN-DSC-040).
 */

import type { UserId } from '@memorysmithapp/kernel';
import type { AvatarRepository, MemberAvatar, PictureTypes } from '../domain/ports/index.js';
import { ACCESS_LIMITS, AvatarSource, type Email } from '../domain/values.js';

/** A picture as the organization's directory keeps it. */
export interface DirectoryPicture {
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/**
 * What the directory answered: the picture, that it keeps none, or nothing
 * that says either, which is every failure, a missing permission included.
 */
export type DirectoryAnswer =
  | { readonly kind: 'picture'; readonly picture: DirectoryPicture }
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown' };

/** The organization's directory, asked for the picture of a person. It never throws. */
export interface DirectoryPictures {
  pictureOf(email: Email): Promise<DirectoryAnswer>;
}

const INITIALS: MemberAvatar = { source: AvatarSource.INITIALS, picture: null, mime: null };

export class RefreshFederatedFace {
  constructor(
    /** The avatars of the subscription the session acts for. */
    private readonly avatars: AvatarRepository,
    /** Null where the provider has no directory MemorySmith knows how to ask. */
    private readonly directory: DirectoryPictures | null,
    private readonly types: PictureTypes,
  ) {}

  async execute(input: { person: UserId; email: Email }): Promise<void> {
    const held = await this.avatars.find(input.person);
    const answer: DirectoryAnswer = this.directory
      ? await this.directory.pictureOf(input.email)
      : { kind: 'unknown' };
    const next = this.faceFor(answer, held);
    if (next && !(held && sameFace(held, next))) await this.avatars.save(input.person, next);
  }

  /** The face to keep, or null to keep the one held. */
  private faceFor(answer: DirectoryAnswer, held: MemberAvatar | null): MemberAvatar | null {
    if (answer.kind === 'picture') {
      const { mime, bytes } = answer.picture;
      const usable =
        bytes.length > 0 &&
        bytes.length <= ACCESS_LIMITS.avatarMaxBytes &&
        this.types.accepted.includes(mime) &&
        this.types.supports(mime, bytes);
      return usable ? { source: AvatarSource.UPLOAD, picture: bytes, mime } : INITIALS;
    }
    if (answer.kind === 'none') return INITIALS;
    // Unknown: what the directory gave before stays; Gravatar, which a
    // federated person never chooses, gives way to the initials.
    return held && !held.source.equals(AvatarSource.GRAVATAR) ? null : INITIALS;
  }
}

function sameFace(a: MemberAvatar, b: MemberAvatar): boolean {
  if (!a.source.equals(b.source) || a.mime !== b.mime) return false;
  if (a.picture === null || b.picture === null) return a.picture === b.picture;
  return (
    a.picture.length === b.picture.length && a.picture.every((byte, i) => byte === b.picture![i])
  );
}
