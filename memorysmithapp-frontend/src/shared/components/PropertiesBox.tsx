import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PropertyValue, propertyLabel, propertyType } from './PropertyValue';

/**
 * What a page hands the renderer to draw where the note's frontmatter goes
 * (#300, #530): the name of the note, with what the page says beside it, and
 * its properties in the order the page reads them, `name` left out
 * (RN-DSC-051). The renderer decides which part goes where — the name at the
 * top, the properties at the top, below it, or at the end, and which of them —
 * as a note's `properties` block, or else the notebook's style, says.
 */
export interface NoteHeaderParts {
  readonly title: ReactNode;
  readonly properties: ReadonlyArray<readonly [string, string]>;
  readonly lists: ReadonlySet<string>;
  readonly notebookId: string;
  /** Drawn for paper: open, its heading a heading, with nothing to fold. */
  readonly still?: boolean;
}

/** Two keys are the same key whatever the case, after NFC, as the notebook's attributes compare. */
function sameKey(left: string, right: string): boolean {
  return left.normalize('NFC').toLowerCase() === right.normalize('NFC').toLowerCase();
}

/**
 * The properties the renderer chose, in its order (#530): every one of them in
 * the page's own order — the reserved keys first — when it chose them all,
 * else the keys it names, in the order a block or the style wrote them. A key
 * the note lacks, or holds empty, is simply absent.
 */
export function chosenProperties(
  properties: ReadonlyArray<readonly [string, string]>,
  keys: readonly string[],
): ReadonlyArray<readonly [string, string]> {
  const all =
    properties.length === keys.length &&
    properties.every(([key]) => keys.some((each) => sameKey(each, key)));
  if (all) return properties;
  return keys.flatMap((key) => properties.filter(([each]) => sameKey(each, key)).slice(0, 1));
}

/** A note's properties as the reading surface draws them. */
export function PropertiesBox({
  properties,
  lists,
  notebookId,
  title,
  fold,
  still = false,
}: {
  properties: ReadonlyArray<readonly [string, string]>;
  lists: ReadonlySet<string>;
  notebookId: string;
  title?: string | undefined;
  fold?: 'open' | 'closed' | undefined;
  still?: boolean;
}) {
  const { t } = useTranslation();
  if (properties.length === 0) return null;
  const rows = (
    <div className="metadata-container">
      {properties.map(([key, value]) => (
        <div
          className="metadata-property"
          data-property-type={propertyType(value, lists.has(key))}
          key={key}
        >
          <span className="metadata-property-key">{propertyLabel(key, t)}</span>
          <span className="metadata-property-value">
            <PropertyValue value={value} list={lists.has(key)} notebookId={notebookId} />
          </span>
        </div>
      ))}
    </div>
  );
  // On paper nothing folds: a heading, when one is given, and the rows.
  if (still) {
    return (
      <div className="properties-box">
        {title ? <h2 className="properties-title">{title}</h2> : null}
        {rows}
      </div>
    );
  }
  return (
    <details className="properties-box" open={fold !== 'closed'}>
      <summary>{title ?? t('note.properties')}</summary>
      {rows}
    </details>
  );
}
