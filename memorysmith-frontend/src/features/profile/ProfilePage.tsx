import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar, type AvatarSource } from '../../shared/components/Avatar';
import { useDocumentTitle } from '../../shared/components/document-title';
import { editProfile, setProfilePicture } from '../../shared/api/backend';
import { useLiveSession } from '../../shared/auth/session';
import { preparePicture } from '../../shared/lib/picture';
import { ApiError } from '../../shared/api/error-mapper';

const SOURCES: AvatarSource[] = ['gravatar', 'initials', 'upload'];

/**
 * What a person is called and the face beside it (#168, RN-ACC-021,
 * RN-ACC-022).
 *
 * The e-mail is here to be READ: it is what they sign in with and the key
 * every message goes to, so changing it is another delivery with another rule
 * — a new address has to be proved — and until then it is shown and not typed.
 *
 * The picture is chosen among sources rather than typed, and a URL of their
 * own is not one of them: an avatar renders on every screen without anybody
 * opening anything, so a host they named would be handed every reader
 * (RN-DSC-040). Which is exactly why Gravatar, the source that is already the
 * default, is the one thing on this screen that says what it discloses.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const session = useLiveSession((s) => s.session);
  const applyProfile = useLiveSession((s) => s.applyProfile);

  const [name, setName] = useState('');
  const [source, setSource] = useState<AvatarSource>('gravatar');
  /** The picture in hand: the one on the account, or the one just chosen. */
  const [picture, setPicture] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useDocumentTitle(t('profile.title'), null);

  // The session is the profile: it already carries the name recorded on the
  // account and the picture, so this screen opens on what is true instead of
  // asking for it again and drawing empty fields while it waits.
  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setSource(session.avatar);
    setPicture(session.picture);
  }, [session?.userId, session?.name, session?.avatar, session?.picture]);

  if (!session) return null;
  const email = session.email;

  async function choosePicture(file: File) {
    setFailure(null);
    const prepared = await preparePicture(file);
    if (!prepared) {
      setFailure(t('profile.pictureRefused'));
      return;
    }
    setSaving(true);
    try {
      await setProfilePicture(prepared.mime, prepared.bytes);
      setPicture(prepared.preview);
      setSource('upload');
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t('profile.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setFailure(null);
    try {
      await editProfile(name, source);
      applyProfile({ name: name.trim(), avatar: source, picture });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t('profile.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="profile">
      <h1>{t('profile.heading')}</h1>

      <section className="profile-section">
        <div className="profile-face">
          <Avatar email={email} size={72} source={source} picture={picture} name={name} />
          <div>
            <p className="profile-caption">{t('profile.pictureHeading')}</p>
            <div className="profile-sources">
              {SOURCES.map((option) => (
                <label key={option} className={source === option ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="avatar"
                    value={option}
                    checked={source === option}
                    disabled={option === 'upload' && !picture}
                    onChange={() => setSource(option)}
                  />
                  <span>{t(`profile.source.${option}`)}</span>
                </label>
              ))}
            </div>
            <label className="button is-small profile-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void choosePicture(file);
                }}
              />
              {t('profile.choosePicture')}
            </label>
          </div>
        </div>
        {/*
          The same rule that made a note disclose its remote images makes this
          worth saying: every screen of this product sends gravatar.com the
          hash of an e-mail and the address of whoever is reading (RN-DSC-040).
        */}
        <p className="profile-note">{t('profile.gravatarDiscloses')}</p>
      </section>

      <section className="profile-section">
        <label className="field">
          <span className="field-label">{t('profile.name')}</span>
          <input
            type="text"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('profile.email')}</span>
          <input type="email" value={email} readOnly disabled />
          <span className="field-hint">{t('profile.emailReadOnly')}</span>
        </label>
      </section>

      {failure ? <p className="profile-failure">{failure}</p> : null}

      <div className="profile-actions">
        <button
          type="button"
          className="button is-primary"
          disabled={saving || name.trim().length === 0}
          onClick={() => void save()}
        >
          {saved ? t('profile.saved') : t('profile.save')}
        </button>
        <Link className="button" to="/profile/password">
          {t('password.heading')}
        </Link>
      </div>
    </article>
  );
}
