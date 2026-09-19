import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  stateOfNotes,
  withBranchNotes,
  withContextFolder,
  withNode,
  withTemplate,
  type Chosen,
  type DocumentTree,
  type TreeFolder,
} from './import-selection';

/**
 * What a transfer carries, chosen the same way on both sides (#156).
 *
 * An export used to carry everything or nothing and an import chose from a
 * flat-looking list — two sides of one door answering differently. This is the
 * one chooser: what differs is where the tree came from, the archive for an
 * import and the API for an export, and both arrive in one shape.
 *
 * **Two questions, so two tabs, and each answers only its own.** The context of
 * a notebook — its Guidance, its history, its folders and the Template of each
 * one — is not the same question as which notes travel. So a folder is chosen
 * in the context, with the Template that belongs to it, and the notes tab
 * moves notes and never a folder: a checkbox there that took the folder with it
 * would undo what the other tab was for, which is exactly what it did on the
 * first run against staging — the design of a notebook arrived with no folder
 * at all.
 *
 * **A tree that shows what is under what.** A note used to sit one `rem` from
 * its folder with no twisty, no count and no guide, so a folder of twelve notes
 * read as thirteen rows of one kind. Each level is indented by a real step and
 * carries a line down its side, a folder says how much it holds, and a note is
 * marked as a note.
 */
export type ChooserTab = 'context' | 'notes';

export function TransferChooser({
  tree,
  chosen,
  onChange,
  filter,
  onFilter,
  direction,
}: {
  tree: DocumentTree;
  chosen: Chosen;
  onChange: (next: Chosen) => void;
  filter: string;
  onFilter: (next: string) => void;
  /** Which way this is going, which is what the label of the tree says. */
  direction: 'export' | 'import';
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ChooserTab>('context');

  const hasHistory = tree.historyEntries === null || tree.historyEntries > 0;
  const entries = tree.historyEntries;
  const what = t(`portability.whatToCarry.${direction}`);

  return (
    <div className="chooser">
      <div className="chooser-tabs" role="tablist" aria-label={what}>
        {(['context', 'notes'] as const).map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            id={`chooser-tab-${each}`}
            aria-selected={tab === each}
            aria-controls={`chooser-panel-${each}`}
            className={tab === each ? 'chooser-tab is-selected' : 'chooser-tab'}
            onClick={() => setTab(each)}
          >
            {t(`portability.tab.${each}`)}
          </button>
        ))}
      </div>

      {tab === 'context' ? (
        <div
          className="chooser-panel"
          role="tabpanel"
          id="chooser-panel-context"
          aria-labelledby="chooser-tab-context"
        >
          <ul className="chooser-tree" role="tree" aria-label={t('portability.tab.context')}>
            {/* What is not there is SAID and not hidden: a row that disappears
                cannot be told from a feature that was never built (#160). */}
            <Row
              kind="guidance"
              label={t('portability.notebookGuidance')}
              note={tree.guidance ? undefined : t('portability.thereIsNone')}
              missing={!tree.guidance}
              checked={tree.guidance && chosen.guidance}
              onToggle={(on) => onChange({ ...chosen, guidance: on })}
            />
            <Row
              kind="history"
              label={t('portability.history')}
              note={
                !hasHistory
                  ? t('portability.thereIsNone')
                  : entries === null
                    ? undefined
                    : t('portability.historyEntries', { count: entries })
              }
              missing={!hasHistory}
              checked={hasHistory && chosen.history}
              onToggle={(on) => onChange({ ...chosen, history: on })}
            />
            <li role="none" className="chooser-section">
              <span className="chooser-section-name">{t('portability.foldersAndTemplates')}</span>
              <ul role="group" className="chooser-branch">
                {tree.folders.map((folder) => (
                  <ContextFolderRow
                    key={folder.id}
                    folder={folder}
                    chosen={chosen}
                    depth={0}
                    onChange={onChange}
                  />
                ))}
              </ul>
            </li>
          </ul>
        </div>
      ) : (
        <div
          className="chooser-panel"
          role="tabpanel"
          id="chooser-panel-notes"
          aria-labelledby="chooser-tab-notes"
        >
          <label className="chooser-filter">
            <span>{t('portability.filter')}</span>
            <input
              type="search"
              value={filter}
              onChange={(event) => onFilter(event.target.value)}
            />
          </label>
          <ul className="chooser-tree" role="tree" aria-label={t('portability.tab.notes')}>
            {tree.folders.map((folder) => (
              <NotesRow
                key={folder.id}
                folder={folder}
                chosen={chosen}
                depth={0}
                filter={filter.trim().toLowerCase()}
                onChange={onChange}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One line of the tree: a box, what it is, and what it says about itself. */
function Row({
  kind,
  label,
  note,
  checked,
  indeterminate,
  missing = false,
  onToggle,
  depth = 0,
  children,
  extra,
}: {
  kind: 'guidance' | 'history' | 'template' | 'folder' | 'note';
  label: string;
  note?: string | undefined;
  checked: boolean;
  indeterminate?: boolean;
  /** The notebook has none of this: the row stays, and says so. */
  missing?: boolean;
  onToggle: (on: boolean) => void;
  depth?: number;
  children?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li role="none" className="chooser-item">
      <div
        role="treeitem"
        aria-selected={checked}
        className={`chooser-row is-${kind}${missing ? ' is-missing' : ''}`}
        style={{ paddingInlineStart: `${depth * 1.25}rem` }}
      >
        {extra}
        <label className="chooser-label">
          <input
            type="checkbox"
            checked={checked}
            disabled={missing}
            ref={(node) => {
              if (node) node.indeterminate = indeterminate ?? false;
            }}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="chooser-name">{label}</span>
        </label>
        {note !== undefined && <span className="chooser-note">{note}</span>}
      </div>
      {children}
    </li>
  );
}

/**
 * A folder of the context, and its Template under it — **two objects, two
 * boxes**. A folder without its notes is the design of a notebook, and a
 * Template is a document of its own that a person may want without the folder's
 * notes, or not want at all.
 *
 * What ties them is one way only: choosing the Template carries its folder,
 * because there is nowhere else to write it, and letting the folder go lets the
 * Template go with it. Choosing the folder carries no Template.
 */
function ContextFolderRow({
  folder,
  chosen,
  depth,
  onChange,
}: {
  folder: TreeFolder;
  chosen: Chosen;
  depth: number;
  onChange: (next: Chosen) => void;
}) {
  const { t } = useTranslation();
  const under = folder.children;

  return (
    <Row
      kind="folder"
      label={folder.name}
      checked={chosen.folders.has(folder.id)}
      onToggle={(on) => onChange(withContextFolder(chosen, folder, on))}
      depth={depth}
    >
      <ul role="group" className="chooser-branch">
        <Row
          kind="template"
          label={t('portability.folderTemplate')}
          note={folder.template ? undefined : t('portability.thereIsNone')}
          missing={folder.template === null}
          checked={folder.template !== null && chosen.templates.has(folder.id)}
          onToggle={(on) => onChange(withTemplate(chosen, folder, on))}
          depth={depth + 1}
        />
        {under.map((child) => (
          <ContextFolderRow
            key={child.id}
            folder={child}
            chosen={chosen}
            depth={depth + 1}
            onChange={onChange}
          />
        ))}
      </ul>
    </Row>
  );
}

/**
 * A folder and the notes in it. Its checkbox takes the notes of the whole
 * branch and never the folder: which folders travel is the other tab, and a
 * folder that holds a chosen note travels anyway, as a path (RN-PRT-017).
 */
function NotesRow({
  folder,
  chosen,
  depth,
  filter,
  onChange,
}: {
  folder: TreeFolder;
  chosen: Chosen;
  depth: number;
  filter: string;
  onChange: (next: Chosen) => void;
}) {
  const { t } = useTranslation();
  // A branch opens collapsed below the first level, so a tree of a thousand
  // notes draws a handful of rows until somebody asks for more.
  const [open, setOpen] = useState(depth === 0);
  const state = stateOfNotes(chosen, folder);
  const notes = filter
    ? folder.notes.filter((note) => note.name.toLowerCase().includes(filter))
    : folder.notes;
  const under = filter
    ? folder.children.filter((child) => holdsMatch(child, filter))
    : folder.children;

  if (filter && notes.length === 0 && under.length === 0) return null;

  return (
    <Row
      kind="folder"
      label={folder.name}
      note={t('portability.noteCount', { count: folder.noteCount })}
      checked={state === 'on'}
      indeterminate={state === 'mixed'}
      onToggle={(on) => onChange(withBranchNotes(chosen, folder, on))}
      depth={depth}
      extra={
        <button
          type="button"
          className="chooser-twisty"
          aria-expanded={open}
          aria-label={t(open ? 'portability.collapse' : 'portability.expand')}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? '▾' : '▸'}
        </button>
      }
    >
      {open && (under.length > 0 || notes.length > 0) && (
        <ul role="group" className="chooser-branch">
          {under.map((child) => (
            <NotesRow
              key={child.id}
              folder={child}
              chosen={chosen}
              depth={depth + 1}
              filter={filter}
              onChange={onChange}
            />
          ))}
          {notes.map((note) => (
            <Row
              key={note.id}
              kind="note"
              label={note.name || t('note.unnamed')}
              checked={chosen.notes.has(note.id)}
              onToggle={(on) => onChange(withNode(chosen, { kind: 'note', id: note.id }, on))}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </Row>
  );
}

/** Whether anything under a folder answers the filter. */
function holdsMatch(folder: TreeFolder, filter: string): boolean {
  return (
    folder.notes.some((note) => note.name.toLowerCase().includes(filter)) ||
    folder.children.some((child) => holdsMatch(child, filter))
  );
}
