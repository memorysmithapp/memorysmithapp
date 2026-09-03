import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { splitEmbeds } from '../api/transclusion';
import { resolveWikilinks } from '../api/markdown';
import { taskBoxes, toggleTaskAt } from '../api/tasklist';
import { resolveNoteUrl } from '../api/source';
import { Markdown } from './Markdown';
import { Transclusion } from './Transclusion';
import { useGroupedWrite, type TaskWrite } from './TaskListWriter';

/**
 * A reading surface whose task boxes can be ticked, when the effective role in
 * this vault allows writing.
 *
 * Three surfaces render the same kind of thing, a Content Slot: the note, the
 * guidance and the template of a folder. A box alive in one and dead in the
 * others would be visible arbitrariness, so the behaviour lives here, once.
 *
 * The text written back is the ORIGINAL one, and not what is on screen: the
 * screen shows wikilinks resolved and embeds expanded, and writing that back
 * would hand the vault a document nobody typed.
 */
export function WritableContent({
  raw,
  vaultSlug,
  baseRevision,
  writable,
  write,
  invalidates,
}: {
  raw: string;
  vaultSlug: string;
  baseRevision: string | null;
  writable: boolean;
  write: (input: TaskWrite) => Promise<unknown>;
  invalidates: unknown[];
}) {
  const { t } = useTranslation();
  const client = useQueryClient();

  const onConflict = useCallback(() => {
    void client.invalidateQueries({ queryKey: invalidates });
  }, [client, invalidates]);

  const { text, toggle, failed } = useGroupedWrite({ raw, baseRevision, write, onConflict });

  const onToggleTask = useCallback(
    (ordinal: number) => {
      const next = toggleTaskAt(text, ordinal);
      if (next !== null) toggle(next);
    },
    [text, toggle],
  );

  // Frontmatter is shown as properties, not as prose, so the reading surface
  // starts after it. Everything below counts task items from there.
  const split = text.startsWith('---') ? text.indexOf('\n---', 3) + 4 : 0;
  const body = text.slice(split);

  // The ordinal a click carries is of the WHOLE document, and each rendered
  // run only knows its own. The count carried across the runs is what bridges
  // the two, and it has to include anything above the body.
  let seen = taskBoxes(text.slice(0, split)).length;

  return (
    <>
      {failed && <p className="status write-failed">{t('note.writeFailed')}</p>}
      {splitEmbeds(body).map((segment, index) => {
        if (segment.kind !== 'text') {
          return (
            <Transclusion
              key={index}
              vaultSlug={vaultSlug}
              target={segment.target}
              anchor={segment.anchor}
            />
          );
        }

        const base = seen;
        seen += taskBoxes(segment.text).length;
        const rendered = resolveWikilinks(segment.text, (slug) => resolveNoteUrl(vaultSlug, slug));

        return (
          <Markdown
            key={index}
            onToggleTask={(ordinal) => onToggleTask(base + ordinal)}
            writable={writable}
          >
            {rendered}
          </Markdown>
        );
      })}
    </>
  );
}
