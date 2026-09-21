/**
 * The account of the person signed in (software-vision.md, section 5.4).
 */

import { DomainError, err, Instant, ok, type Result } from '@memorysmith/kernel';
import { ACCESS_LIMITS, AccountLocale, AvatarSource, PersonName } from '../domain/values.js';
import type {
  AccountDirectory,
  AvatarRepository,
  MemberAvatar,
  PictureTypes,
  UserLinkRepository,
  UserProfile,
} from '../domain/ports/index.js';

/**
 * Records the language the person chose, which every message the product sends
 * this account is written in from then on (RN-ACC-018). It is the person's own
 * act, on their own account, so it needs no subscription and no role: a platform
 * session chooses a language like any other.
 */
export class ChooseLanguage {
  constructor(private readonly directory: AccountDirectory) {}

  async execute(input: {
    profile: UserProfile;
    locale: string;
  }): Promise<Result<void, DomainError>> {
    const locale = AccountLocale.create(input.locale);
    if (!locale.ok) return locale;
    await this.directory.setLocale(input.profile.email, locale.value);
    return ok();
  }
}

/**
 * Records that this person has seen the welcome surface, which is what makes
 * it stop opening on its own (#167, RN-ACC-019). It is their own act on their
 * own account, so it needs no subscription and no role, and it is written once:
 * a second visit, from the user menu, never moves the date.
 */
export class RecordWelcome {
  constructor(private readonly links: UserLinkRepository) {}

  async execute(input: { profile: UserProfile }): Promise<Result<void, DomainError>> {
    await this.links.markWelcomed(input.profile.userId, Instant.now().toISOString());
    return ok();
  }
}

/**
 * The profile of the person signed in: what they are called and the face
 * beside it (RN-ACC-021, RN-ACC-022).
 *
 * The e-mail is not here to be written. It is what the person signs in with
 * and the key every message goes to, so changing it is another delivery with
 * another rule — a new address has to be proved — and until then it is shown
 * and never typed.
 */
export interface ProfileView {
  readonly email: string;
  readonly name: string;
  readonly avatar: string;
  /** The picture itself, as a data URL, when the source is an upload. */
  readonly picture: string | null;
}

/** The picture of a person, as a data URL, or null when there is none to draw. */
export function pictureUrlOf(avatar: MemberAvatar | null): string | null {
  if (!avatar || !avatar.picture || !avatar.mime) return null;
  return `data:${avatar.mime};base64,${Buffer.from(avatar.picture).toString('base64')}`;
}

export class ReadProfile {
  constructor(
    private readonly directory: AccountDirectory,
    /** Null for a session with no subscription: a picture lives inside one. */
    private readonly avatars: AvatarRepository | null,
  ) {}

  async execute(input: { profile: UserProfile }): Promise<Result<ProfileView, DomainError>> {
    const avatar = (await this.avatars?.find(input.profile.userId)) ?? null;
    // The account is asked rather than the token, because a token minted
    // before the last edit still carries what it replaced.
    const recorded = await this.directory.nameOf(input.profile.email);
    return ok({
      email: input.profile.email.value,
      name: recorded ?? input.profile.name,
      avatar: (avatar?.source ?? AvatarSource.DEFAULT).name,
      picture: pictureUrlOf(avatar),
    });
  }
}

/**
 * Records the name the person typed and where their picture comes from.
 *
 * WHAT THE PERSON TYPED WINS (RN-ACC-021). The identity provider and Gravatar
 * are what fill an empty field, and neither of them ever overwrites this.
 *
 * Choosing `upload` without having sent a picture is refused: it would leave
 * the screens drawing nothing and calling it a choice.
 */
export class EditProfile {
  constructor(
    private readonly directory: AccountDirectory,
    private readonly avatars: AvatarRepository | null,
  ) {}

  async execute(input: {
    profile: UserProfile;
    name: string;
    avatar: string;
  }): Promise<Result<void, DomainError>> {
    const name = PersonName.create(input.name);
    if (!name.ok) return name;
    const source = AvatarSource.create(input.avatar);
    if (!source.ok) return source;

    if (!source.value.equals(AvatarSource.GRAVATAR) && !this.avatars) {
      return err(DomainError.forbidden('A picture is kept inside a subscription'));
    }

    if (source.value.equals(AvatarSource.UPLOAD)) {
      const held = await this.avatars?.find(input.profile.userId);
      if (!held?.picture) {
        return err(DomainError.validation('There is no picture to show: send one first'));
      }
    }

    await this.directory.setName(input.profile.email, name.value);
    if (this.avatars) {
      const held = await this.avatars.find(input.profile.userId);
      await this.avatars.save(input.profile.userId, {
        source: source.value,
        // The bytes survive a change of source, so somebody who tries the
        // initials and comes back does not have to send the picture again.
        picture: held?.picture ?? null,
        mime: held?.mime ?? null,
      });
    }
    return ok();
  }
}

/**
 * Keeps the picture somebody sent, and makes it their source in one act
 * (RN-ACC-022).
 *
 * It is bounded rather than budgeted: an avatar is not content of a notebook,
 * so it rides on no notebook, counts against no quota and is purged by no
 * deletion of one. What keeps that honest is the ceiling — the interface draws
 * the chosen file down before sending it, and anything still over it is
 * refused, naming the ceiling.
 *
 * The declared type is checked AGAINST THE BYTES, like every other thing this
 * product stores: what a file is called decides nothing, and the only thing
 * that can establish what a picture is is the picture.
 */
export class SetProfilePicture {
  constructor(
    private readonly avatars: AvatarRepository | null,
    private readonly types: PictureTypes,
  ) {}

  async execute(input: {
    profile: UserProfile;
    mime: string;
    bytes: Uint8Array;
  }): Promise<Result<void, DomainError>> {
    if (!this.avatars) {
      return err(DomainError.forbidden('A picture is kept inside a subscription'));
    }
    if (!this.types.accepted.includes(input.mime)) {
      return err(
        DomainError.validation(`Not a type a picture is kept as: ${input.mime}`, {
          accepted: this.types.accepted,
        }),
      );
    }
    if (input.bytes.length === 0) return err(DomainError.validation('The picture is empty'));
    if (input.bytes.length > ACCESS_LIMITS.avatarMaxBytes) {
      return err(
        DomainError.validation(`A picture is at most ${ACCESS_LIMITS.avatarMaxBytes} bytes`, {
          bytes: input.bytes.length,
          ceiling: ACCESS_LIMITS.avatarMaxBytes,
        }),
      );
    }
    if (!this.types.supports(input.mime, input.bytes)) {
      return err(
        DomainError.validation(`These bytes are not ${input.mime}`, { declared: input.mime }),
      );
    }

    await this.avatars.save(input.profile.userId, {
      source: AvatarSource.UPLOAD,
      picture: input.bytes,
      mime: input.mime,
    });
    return ok();
  }
}

/**
 * Changes the password of the person signed in, stating the current one
 * (RN-ACC-023).
 *
 * It is a CHANGE and not a recovery: the current password proves the person in
 * front of the screen, where a code sent to a mailbox proves the mailbox. The
 * forgotten-password door stays where it is, on the sign-in screen, for
 * whoever does not know it.
 *
 * Nothing here is stored and nothing is logged: the two passwords cross this
 * use case and end in the identity provider.
 */
export class ChangePassword {
  constructor(private readonly directory: AccountDirectory) {}

  async execute(input: {
    profile: UserProfile;
    current: string;
    next: string;
  }): Promise<Result<void, DomainError>> {
    if (!input.current || !input.next) {
      return err(DomainError.validation('Both the current password and the new one are needed'));
    }
    if (input.current === input.next) {
      return err(DomainError.validation('The new password is the current one'));
    }
    return this.directory.changePassword(input.profile.email, input.current, input.next);
  }
}
