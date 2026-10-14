import { useEffect, useState } from 'react';
import { avatarUrl } from '../auth/gravatar';

/** Where the face comes from, as the API spells it (RN-ACC-022). */
export type AvatarSource = 'gravatar' | 'initials' | 'upload';

interface AvatarProps {
  email: string;
  size?: number;
  /** The source the person chose; Gravatar for anybody who chose nothing. */
  source?: AvatarSource;
  /** The picture they uploaded, as a data URL, when that is the source. */
  picture?: string | null;
  /** What the initials are drawn from, when that is the source. */
  name?: string | null;
}

/**
 * Two letters from a name, which is the whole of what this source draws.
 *
 * The first letter of the first word and of the last, so `Heitor Rapcinski`
 * reads `HR` and a single word reads its first letter alone. An e-mail is the
 * fallback because a person with no name still has one of those, and its
 * local part is what somebody would read out.
 */
export function initialsOf(name: string, email: string): string {
  const source = name.trim().length > 0 ? name.trim() : (email.split('@')[0] ?? '');
  const words = source.split(/[\s._-]+/u).filter((word) => word.length > 0);
  if (words.length === 0) return '?';
  const first = [...(words[0] ?? '')][0] ?? '';
  const last = words.length > 1 ? ([...(words[words.length - 1] ?? '')][0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

export function Avatar({ email, size = 32, source = 'gravatar', picture, name }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  const fromGravatar = source === 'gravatar';

  useEffect(() => {
    if (!fromGravatar) {
      setUrl(null);
      return;
    }
    let alive = true;
    void avatarUrl(email, size * 2).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [email, size, fromGravatar]);

  /**
   * The one source that asks nothing of anybody: no request leaves, so nothing
   * about this person is disclosed to draw their own face (RN-ACC-022). It is
   * also what a picture falls back to while there is none to draw.
   */
  if (source === 'initials' || (source === 'upload' && !picture)) {
    return (
      <span
        className="avatar avatar-initials"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        aria-hidden="true"
      >
        {initialsOf(name ?? '', email)}
      </span>
    );
  }

  if (source === 'upload' && picture) {
    return <img className="avatar" src={picture} alt="" width={size} height={size} />;
  }

  if (!url)
    return <span className="avatar avatar-fallback" style={{ width: size, height: size }} />;
  return (
    <img
      className="avatar"
      src={url}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
    />
  );
}
