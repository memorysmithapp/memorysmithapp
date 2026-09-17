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
  readonly address: string;
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
  const trailOf = (option: LinkChoiceOption): string =>
    option.trail.join(' › ') || t('structure.root');
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
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
