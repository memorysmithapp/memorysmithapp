import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What a link to more than one note has to say, in ONE place (RN-DSC-046).
 *
 * Two surfaces render it: the dialog a wikilink opens where it is clicked, and
 * the page at the address of the target, reached by pasting it or opening the
 * link in a new tab. They used to be written twice and drifted apart, and the
 * explanation is the whole point of both — that one name reaches several notes,
 * and what tells them apart.
 *
 * **What leads an option depends on what matched.** Matched by name, every
 * option carries the same name, so repeating it is noise: the folder trail
 * leads, and the name is said once, in the explanation. Matched by alias, the
 * names differ, so each option leads with its name and carries the trail under
 * it — and the explanation says that an edge held by an alias is one somebody
 * takes back the day they write a note under that name (RN-DSC-053).
 */
export interface LinkChoiceOption {
  readonly noteId: string;
  readonly name: string;
  /** The folders from the root down to the one that holds the note. */
  readonly trail: readonly string[];
  /**
   * What the folder that holds it is for, in the words of whoever wrote the
   * notebook. A path tells two notes of one name apart; the description says
   * which of the two was meant, and it is the one thing on this row that
   * answers that without opening either.
   */
  readonly folderDescription: string;
  readonly address: string;
}

/**
 * How long a description may be on a row of a choice.
 *
 * It is a folder description, which is written to be read whole somewhere
 * else — the chooser, the tree, the Notebook Context an agent reads. Here it
 * is a hint under a path, and three rows of prose would bury the paths they
 * were supposed to tell apart. Cut on a word, never mid-word, and say that it
 * was cut.
 */
const DESCRIPTION_LIMIT = 120;

export function shortened(description: string, limit = DESCRIPTION_LIMIT): string {
  const text = description.trim().replace(/\s+/g, ' ');
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface LinkChoiceContentProps {
  readonly target: string;
  readonly by: 'name' | 'alias' | null;
  readonly options: readonly LinkChoiceOption[];
  readonly state: 'loading' | 'error' | 'ready';
  /** Navigating inside the application, when the surface does that itself. */
  readonly onPick?: ((address: string) => void) | undefined;
}

/** Three rows of nothing, so a click never looks ignored while it resolves. */
function Placeholders() {
  return (
    <ul className="link-choice-options" aria-hidden="true">
      {[0, 1].map((row) => (
        <li key={row}>
          <span className="link-choice-option is-placeholder" />
        </li>
      ))}
    </ul>
  );
}

export function LinkChoiceContent({ target, by, options, state, onPick }: LinkChoiceContentProps) {
  const { t } = useTranslation();

  if (state === 'loading') {
    return (
      <div className="link-choice-body" aria-busy="true">
        <p className="link-choice-explanation">{t('common.loading')}</p>
        <Placeholders />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="link-choice-body">
        <p className="link-choice-explanation">{t('errors.unexpected')}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="link-choice-body">
        <p className="link-choice-explanation">{t('note.targetPending', { target })}</p>
      </div>
    );
  }

  const byAlias = by === 'alias';
  /**
   * The path, written the way a path is written. It was `A › B`, which reads
   * as a breadcrumb of a page somebody is on; this is an address of a place a
   * note is IN, and `/A/B` says so — the root included, as `/`.
   */
  const trailOf = (option: LinkChoiceOption): string =>
    option.trail.length === 0 ? '/' : `/${option.trail.join('/')}`;
  const pick = (address: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onPick) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onPick(address);
  };

  return (
    <div className="link-choice-body">
      <p className="link-choice-explanation">
        {byAlias
          ? t('note.targetAliased', { target, count: options.length })
          : t('note.targetNamed', { target, count: options.length })}
      </p>
      <ul className="link-choice-options">
        {options.map((option) => (
          <li key={option.noteId}>
            <a className="link-choice-option" href={option.address} onClick={pick(option.address)}>
              <span className="link-choice-lead">
                {byAlias ? option.name || t('note.unnamed') : trailOf(option)}
              </span>
              {/* Matched by name, every option carries the same name, and it
                  is already in the explanation: the trail alone tells them
                  apart. Matched by alias, the names differ and lead. */}
              {byAlias && <span className="link-choice-under">{trailOf(option)}</span>}
              {option.folderDescription.trim().length > 0 && (
                <span className="link-choice-about">{shortened(option.folderDescription)}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
