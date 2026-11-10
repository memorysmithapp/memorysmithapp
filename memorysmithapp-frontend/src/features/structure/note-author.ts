import type { TFunction } from 'i18next';
import type { NoteAuthor } from '../../shared/types/api';

/**
 * Who changed a note last, as a list says it (#416, #417): an agent by the
 * name its client gave itself, the person reading, or another person of the
 * notebook. The interface knows a person by an identifier only, which it does
 * not show.
 */
export function authorLabel(author: NoteAuthor, me: string, t: TFunction): string {
  if (author.agent) return t('noteAuthor.agent', { name: author.agent });
  return author.userId === me ? t('noteAuthor.you') : t('noteAuthor.person');
}

/** Whether an agent wrote it, which a list marks apart from a person. */
export function byAgent(author: NoteAuthor): boolean {
  return author.agent !== null;
}
