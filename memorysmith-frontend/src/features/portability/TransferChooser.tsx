import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  offeredFolders,
  pickBranch,
  pickOne,
  scopeCountsOf,
  stateOfBranch,
  type Chosen,
  type DocumentTree,
  type OfferableFolder,
  type Picked,
  type Reach,
  type Scope,
  type Species,
} from './import-selection';

/**
 * What a transfer carries, chosen the same way on both sides (#156, #161).
 *
 * An export used to carry everything or nothing and an import chose from a
 * flat-looking list — two sides of one door answering differently. This is the
 * one chooser: what differs is where the tree came from, the archive for an
 * import and the API for an export, and both arrive in one shape.
 *
 * **The scope is asked before the items.** It used to ask item by item, in one
 * tree holding five different kinds of thing, so the first question anybody
 * actually has — *the design of the notebook, or the notebook* — had nowhere to
 * be answered, and the sizes of what was on offer appeared only in the summary
 * at the foot, after every box had been ticked. The first tab is now five rows,
 * one per species, each saying whether that species travels, how much of it
 * does, and how much there is (#161).
 *
 * **A species with a hierarchy gets a tab of its own**, opened by its own
 * `Choose items`, and each of those tabs shows only what the folders let
 * through — because a Template and a note belong to a folder and neither can
 * travel without it. That was always true and the screen never said it: unticking
 * a folder left its notes tickable in the other tab, and the import then kept a
 * promise nobody had made. Each dependent tab now states its scoping in a line
 * at the top, and says what to do when the scoping leaves it empty.
 *
 * **A tab that is not open stays visible and disabled**, never hidden: a tab
 * that disappears cannot be told from one that was never built (#160).
 */
export type ChooserTab = 'context' | Species;

const TABS: ReadonlyArray<ChooserTab> = ['context', 'folders', 'templates', 'notes'];

export function TransferChooser({
  tree,
  scope,
  onScope,
  picked,
  onPicked,
  chosen,
  filter,
  onFilter,
  direction,
}: {
  tree: DocumentTree;
  scope: Scope;
  onScope: (next: Scope) => void;
  picked: Picked;
  onPicked: (next: Picked) => void;
  /** What actually travels under the scope, which the parent already computes. */
  chosen: Chosen;
  filter: string;
  onFilter: (next: string) => void;
  /** Which way this is going, which is what the label of the tree says. */
  direction: 'export' | 'import';
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ChooserTab>('context');

  const counts = scopeCountsOf(tree, chosen);
  const what = t(`portability.whatToCarry.${direction}`);

  /** A species is choosable when it travels, in items, and there is any. */
  const opens = (species: Species): boolean =>
    scope[species] &&
    scope.reach[species] === 'choose' &&
    counts[species].held > 0 &&
    (species === 'folders' || scope.folders);

  // A tab that closes under the person — unticking Folders closes three —
  // hands the chooser back to the scope rather than drawing an empty panel.
  const active: ChooserTab = tab === 'context' || opens(tab) ? tab : 'context';

  return (
    <div className="chooser">
      <div className="chooser-tabs" role="tablist" aria-label={what}>
        {TABS.map((each) => {
          const disabled = each !== 'context' && !opens(each);
          return (
            <button
              key={each}
              type="button"
              role="tab"
              id={`chooser-tab-${each}`}
              aria-selected={active === each}
              aria-controls={`chooser-panel-${each}`}
              disabled={disabled}
              className={active === each ? 'chooser-tab is-selected' : 'chooser-tab'}
              onClick={() => setTab(each)}
            >
              {t(`portability.tab.${each}`)}
            </button>
          );
        })}
      </div>

      <div
        className="chooser-panel"
        role="tabpanel"
        id={`chooser-panel-${active}`}
        aria-labelledby={`chooser-tab-${active}`}
      >
        {active === 'context' ? (
          <ScopePanel
            tree={tree}
            scope={scope}
            onScope={onScope}
            counts={counts}
            onOpen={(species) => setTab(species)}
          />
        ) : (
          <ItemsPanel
            tree={tree}
            species={active}
            chosen={chosen}
            scope={scope}
            picked={picked}
            onPicked={onPicked}
            filter={filter}
            onFilter={onFilter}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The scope: five species, and for the three that have a hierarchy, how much of
 * each one travels.
 *
 * What is not there is SAID and not hidden, which is the rule the whole dialog
 * follows (#160): a notebook with no Guidance keeps the row and says there is
 * none, and so does one with no Template anywhere and one with no history.
 */
function ScopePanel({
  tree,
  scope,
  onScope,
  counts,
  onOpen,
}: {
  tree: DocumentTree;
  scope: Scope;
  onScope: (next: Scope) => void;
  counts: Record<Species, { carried: number; held: number }>;
  onOpen: (species: Species) => void;
}) {
  const { t } = useTranslation();
  const hasHistory = tree.historyEntries === null || tree.historyEntries > 0;
  const entries = tree.historyEntries;

  return (
    <ul className="chooser-scope" role="list">
      <ScopeRow
        kind="guidance"
        label={t('portability.notebookGuidance')}
        note={tree.guidance ? undefined : t('portability.thereIsNone')}
        missing={!tree.guidance}
        checked={tree.guidance && scope.guidance}
        onToggle={(on) => onScope({ ...scope, guidance: on })}
      />
      <ScopeRow
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
        checked={hasHistory && scope.history}
        onToggle={(on) => onScope({ ...scope, history: on })}
      />
      {(['folders', 'templates', 'notes'] as const).map((species) => {
        const held = counts[species].held;
        // Nothing travels without its folder, so the two that depend on one
        // say so instead of offering a box that would carry nothing.
        const blocked = species !== 'folders' && !scope.folders;
        const missing = held === 0 || blocked;
        return (
          <ScopeRow
            key={species}
            kind={species}
            label={t(`portability.tab.${species}`)}
            note={
              held === 0
                ? t('portability.thereIsNone')
                : blocked
                  ? t('portability.needsFolders')
                  : t('portability.carriedOf', { carried: counts[species].carried, held })
            }
            missing={missing}
            checked={!missing && scope[species]}
            onToggle={(on) => onScope({ ...scope, [species]: on })}
            reach={!missing && scope[species] ? scope.reach[species] : null}
            onReach={(reach) => {
              onScope({ ...scope, reach: { ...scope.reach, [species]: reach } });
              if (reach === 'choose') onOpen(species);
            }}
          />
        );
      })}
    </ul>
  );
}

/** One species of the scope: a box, what it is, how much of it, and how much. */
function ScopeRow({
  kind,
  label,
  note,
  checked,
  missing,
  onToggle,
  reach,
  onReach,
}: {
  kind: 'guidance' | 'history' | Species;
  label: string;
  note?: string | undefined;
  checked: boolean;
  /** The notebook has none of this, or nothing to hold it: it says so. */
  missing: boolean;
  onToggle: (on: boolean) => void;
  /** Absent on the two species that have nothing under them to walk. */
  reach?: Reach | null;
  onReach?: (next: Reach) => void;
}) {
  const { t } = useTranslation();

  return (
    <li className={`chooser-scope-row is-${kind}${missing ? ' is-missing' : ''}`}>
      <label className="chooser-label">
        <input
          type="checkbox"
          checked={checked}
          disabled={missing}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className="chooser-name">{label}</span>
      </label>
      {note !== undefined && <span className="chooser-note">{note}</span>}
      {reach && onReach && (
        <div className="chooser-reach" role="radiogroup" aria-label={label}>
          {(['all', 'choose'] as const).map((each) => (
            <label key={each} className="chooser-reach-option">
              <input
                type="radio"
                name={`reach-${kind}`}
                checked={reach === each}
                onChange={() => onReach(each)}
              />
              <span>{t(`portability.reach.${each}`)}</span>
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The items of one species, in the tree of the folders that let them through.
 *
 * The scoping is stated at the top, always — including when there is no scoping,
 * because `Everything` on the folders is also an answer to *why is this what I
 * see* — and when it leaves nothing, the line becomes the state of the panel and
 * names the way out instead of showing an empty list.
 */
function ItemsPanel({
  tree,
  species,
  scope,
  chosen,
  picked,
  onPicked,
  filter,
  onFilter,
}: {
  tree: DocumentTree;
  species: Species;
  scope: Scope;
  chosen: Chosen;
  picked: Picked;
  onPicked: (next: Picked) => void;
  filter: string;
  onFilter: (next: string) => void;
}) {
  const { t } = useTranslation();
  // The Folders tab chooses the folders, so every folder is on offer there.
  const offered = species === 'folders' ? null : chosen.folders;
  const folders = offeredFolders(tree.folders, offered, species);

  return (
    <>
      {species !== 'folders' && (
        <p className="chooser-scoping">
          {scope.reach.folders === 'all'
            ? t('portability.everyFolderHere')
            : t('portability.onlyChosenFolders')}
        </p>
      )}
      {species === 'notes' && folders.length > 0 && (
        <label className="chooser-filter">
          <span>{t('portability.filter')}</span>
          <input type="search" value={filter} onChange={(event) => onFilter(event.target.value)} />
        </label>
      )}
      {folders.length === 0 ? (
        <p className="chooser-empty">{t(`portability.noFolderChosen.${species}`)}</p>
      ) : (
        <ul className="chooser-tree" role="tree" aria-label={t(`portability.tab.${species}`)}>
          {folders.map((folder) => (
            <BranchRow
              key={folder.id}
              folder={folder}
              species={species}
              picked={picked}
              depth={0}
              filter={species === 'notes' ? filter.trim().toLowerCase() : ''}
              onPicked={onPicked}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** One line of the tree: a box, what it is, and what it says about itself. */
function Row({
  kind,
  label,
  note,
  checked,
  indeterminate,
  onToggle,
  depth = 0,
  children,
  extra,
}: {
  kind: 'folder' | 'path' | 'template' | 'note';
  label: string;
  note?: string | undefined;
  checked: boolean;
  indeterminate?: boolean;
  /** Absent on a path: a folder travelling as a path decides nothing. */
  onToggle?: ((on: boolean) => void) | undefined;
  depth?: number;
  children?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <li role="none" className="chooser-item">
      <div
        role="treeitem"
        aria-selected={checked}
        className={`chooser-row is-${kind}`}
        style={{ paddingInlineStart: `${depth * 1.25}rem` }}
      >
        {extra}
        {onToggle ? (
          <label className="chooser-label">
            <input
              type="checkbox"
              checked={checked}
              ref={(node) => {
                if (node) node.indeterminate = indeterminate ?? false;
              }}
              onChange={(event) => onToggle(event.target.checked)}
            />
            <span className="chooser-name">{label}</span>
          </label>
        ) : (
          <span className="chooser-label">
            <span className="chooser-name">{label}</span>
          </span>
        )}
        {note !== undefined && <span className="chooser-note">{note}</span>}
      </div>
      {children}
    </li>
  );
}

/**
 * A folder and what it offers of one species, with the branch under it.
 *
 * **One checkbox, one species, the whole branch.** Ticking a folder in the
 * Folders tab takes the folders under it and never their Templates or their
 * notes: which folders travel is one question and what they carry is another,
 * and a checkbox that answered both is what made the previous chooser
 * unreadable. Wanting a folder without the folders under it is still said here,
 * by ticking it and unticking each child, which leaves it ticked and shows it
 * as mixed.
 *
 * A folder travelling as a path — not chosen, but holding something that was —
 * is drawn without a box, because it carries its name and its description and
 * nothing else of its own (RN-PRT-017).
 */
function BranchRow({
  folder,
  species,
  picked,
  depth,
  filter,
  onPicked,
}: {
  folder: OfferableFolder;
  species: Species;
  picked: Picked;
  depth: number;
  filter: string;
  onPicked: (next: Picked) => void;
}) {
  const { t } = useTranslation();
  // A branch opens collapsed below the first level, so a tree of a thousand
  // notes draws a handful of rows until somebody asks for more.
  const [open, setOpen] = useState(depth === 0);
  const state = stateOfBranch(picked, folder, species);

  const notes =
    species !== 'notes'
      ? []
      : filter
        ? folder.notes.filter((note) => note.name.toLowerCase().includes(filter))
        : folder.notes;
  const under = filter
    ? folder.children.filter((child) => holdsMatch(child, filter))
    : folder.children;

  if (filter && notes.length === 0 && under.length === 0) return null;

  const note = !folder.offered
    ? t('portability.pathFolder')
    : species === 'notes'
      ? t('portability.noteCount', { count: folder.noteCount })
      : species === 'templates' && folder.template === null
        ? t('portability.noTemplate')
        : undefined;

  return (
    <Row
      kind={folder.offered ? 'folder' : 'path'}
      label={folder.name}
      note={note}
      checked={state === 'on'}
      indeterminate={state === 'mixed'}
      onToggle={
        folder.offered ? (on) => onPicked(pickBranch(picked, folder, species, on)) : undefined
      }
      depth={depth}
      extra={
        under.length > 0 || notes.length > 0 ? (
          <button
            type="button"
            className="chooser-twisty"
            aria-expanded={open}
            aria-label={t(open ? 'portability.collapse' : 'portability.expand')}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="chooser-twisty is-empty" aria-hidden="true" />
        )
      }
    >
      {open && (under.length > 0 || notes.length > 0) && (
        <ul role="group" className="chooser-branch">
          {under.map((child) => (
            <BranchRow
              key={child.id}
              folder={child}
              species={species}
              picked={picked}
              depth={depth + 1}
              filter={filter}
              onPicked={onPicked}
            />
          ))}
          {notes.map((each) => (
            <Row
              key={each.id}
              kind="note"
              label={each.name || t('note.unnamed')}
              checked={picked.notes.has(each.id)}
              onToggle={(on) => onPicked(pickOne(picked, 'notes', each.id, on))}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </Row>
  );
}

/** Whether anything under a folder answers the filter. */
function holdsMatch(folder: OfferableFolder, filter: string): boolean {
  return (
    folder.notes.some((note) => note.name.toLowerCase().includes(filter)) ||
    folder.children.some((child) => holdsMatch(child, filter))
  );
}
