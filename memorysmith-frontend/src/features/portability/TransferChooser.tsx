import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n';
import { Tabs } from '../../shared/components/Tabs';
import {
  offeredFolders,
  pickBranch,
  pickOne,
  scopeCountsOf,
  seedOf,
  stateOfBranch,
  twinNoteIds,
  type Chosen,
  type DocumentTree,
  type OfferableFolder,
  type Picked,
  type Reach,
  type Scope,
  type Species,
  type TwinNames,
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
 *
 * **The whole notebook or part of it is the first thing the first tab asks**,
 * and the chooser is on the screen whichever the answer is. It used to be a
 * pair of radios ABOVE the chooser, which made the chooser appear and vanish —
 * and what vanished with it was the tab that holds what refuses: somebody
 * importing a whole notebook under a name they already have was told so by a
 * sentence appearing under the name field, pushing the screen down under their
 * hand, because there was nowhere else for it to be said (#161).
 */
export type ChooserTab = 'context' | Species | 'conflicts';

/** The whole notebook, or part of it (RN-PRT-017, RN-PRT-024). */
export type Preset = 'everything' | 'choose';

const TABS: ReadonlyArray<ChooserTab> = [
  'context',
  'folders',
  'templates',
  'notes',
  // The files, which are flat: a file belongs to the notebook and not to a
  // folder, so the tab is a list and nothing above it takes one out (#176).
  'files',
  // Last, and lit: it is not a fifth thing to choose but the reason the
  // choosing cannot end, and it opens only when there is one (#161).
  'conflicts',
];

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
  tab,
  onTab,
  preset,
  onPreset,
  twins = [],
  nameTaken = null,
  onFixName,
  onFindNote,
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
  /**
   * Which tab is open, held by whoever opened the chooser: the foot of the
   * dialog sends somebody straight to a conflict, and it cannot do that with
   * the tab hidden in here (#161).
   */
  tab: ChooserTab;
  onTab: (next: ChooserTab) => void;
  /**
   * The whole notebook, or part of it. It is the head of the first tab, and
   * the three species that have a hierarchy open a tab of their own only under
   * `choose` (RN-PRT-017, RN-PRT-024).
   */
  preset: Preset;
  onPreset: (next: Preset) => void;
  /**
   * Names carried twice in one folder, which refuse the import (RN-KNW-042).
   * Empty on the way out: a notebook cannot hold two live notes of one name.
   */
  twins?: ReadonlyArray<TwinNames>;
  /**
   * The name this import would arrive under, when a notebook of the
   * subscription already holds it (RN-KNW-032). It refuses the import like a
   * collision does, so it is told where every refusal is told.
   */
  nameTaken?: string | null;
  /** Back to the field that holds the name, which is outside the chooser. */
  onFixName?: (() => void) | undefined;
  /**
   * Take me to the copies of this name. The chooser cannot do it on its own:
   * the notes have to be being chosen item by item for one to be unticked, and
   * that is the scope, which lives with whoever opened the chooser.
   */
  onFindNote?: (name: string) => void;
}) {
  const { t } = useTranslation();
  const setTab = onTab;

  const counts = scopeCountsOf(tree, chosen);
  const what = t(`portability.whatToCarry.${direction}`);

  /** How many things refuse what is being asked for, all of them in one tab. */
  const refusals = twins.length + (nameTaken === null ? 0 : 1);

  /** A species is choosable when it travels, in items, and there is any. */
  const opens = (each: ChooserTab): boolean => {
    if (each === 'context') return true;
    if (each === 'conflicts') return refusals > 0;
    return (
      preset === 'choose' &&
      scope[each] &&
      scope.reach[each] === 'choose' &&
      counts[each].held > 0 &&
      (each === 'folders' || each === 'files' || scope.folders)
    );
  };

  // A tab that closes under the person — unticking Folders closes three, and
  // resolving the last collision closes this one — hands the chooser back to
  // the scope rather than drawing an empty panel.
  const active: ChooserTab = opens(tab) ? tab : 'context';

  return (
    <div className="chooser">
      <Tabs
        id="chooser"
        label={what}
        className="chooser-tabs"
        active={active}
        onSelect={setTab}
        tabs={TABS.map((each) => ({
          key: each,
          label: t(`portability.tab.${each}`),
          disabled: !opens(each),
          ...(each === 'conflicts' && refusals > 0 ? { count: refusals } : {}),
        }))}
      />

      <div
        className="chooser-panel"
        role="tabpanel"
        id="chooser-panel"
        aria-labelledby={`chooser-tab-${active}`}
      >
        {active === 'conflicts' ? (
          <ConflictsPanel
            twins={twins}
            nameTaken={nameTaken}
            onFixName={onFixName}
            onFindNote={onFindNote}
          />
        ) : active === 'context' ? (
          <ScopePanel
            tree={tree}
            scope={scope}
            onScope={onScope}
            counts={counts}
            preset={preset}
            onPreset={onPreset}
            direction={direction}
            onChoose={(species) => {
              // The tab opens on everything, which is what somebody who asked
              // to choose is taking things out of — and only when nothing was
              // ticked, so flipping back and forth never destroys their work.
              if (picked[species].size === 0) {
                onPicked({ ...picked, [species]: seedOf(tree, species) });
              }
              setTab(species);
            }}
          />
        ) : active === 'files' ? (
          <FilesPanel tree={tree} picked={picked} onPicked={onPicked} />
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
            twins={twins}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The scope: the whole notebook or part of it, and under it five species —
 * for the three that have a hierarchy, how much of each one travels.
 *
 * What is not there is SAID and not hidden, which is the rule the whole dialog
 * follows (#160): a notebook with no Guidance keeps the row and says there is
 * none, and so does one with no Template anywhere and one with no history.
 *
 * Under **the whole notebook** the five rows are still drawn, ticked and
 * frozen: they are no longer a question, and they are the answer to *what does
 * the whole notebook mean here* — which the sentence beside the choice says in
 * words and these rows say in numbers.
 */
function ScopePanel({
  tree,
  scope,
  onScope,
  counts,
  preset,
  onPreset,
  direction,
  onChoose,
}: {
  tree: DocumentTree;
  scope: Scope;
  onScope: (next: Scope) => void;
  counts: Record<Species, { carried: number; held: number }>;
  preset: Preset;
  onPreset: (next: Preset) => void;
  direction: 'export' | 'import';
  /** Called when a species is flipped to `Choose items`, which opens its tab. */
  onChoose: (species: Species) => void;
}) {
  const { t } = useTranslation();
  const hasHistory = tree.historyEntries === null || tree.historyEntries > 0;
  const entries = tree.historyEntries;
  // Under the whole notebook nothing here is a question, and every row says so.
  const frozen = preset === 'everything';

  return (
    <div className="chooser-scroll">
      <div
        className="transfer-presets"
        role="radiogroup"
        aria-label={t(`portability.whatToCarry.${direction}`)}
      >
        {(['everything', 'choose'] as const).map((each) => (
          <label key={each} className="transfer-preset">
            <input
              type="radio"
              name="transfer-preset"
              checked={preset === each}
              onChange={() => onPreset(each)}
            />
            <span>
              <strong>{t(`portability.preset.${each}`)}</strong>
              {each === 'everything' && preset === 'everything' && (
                <small>{t('portability.wholeNotebookHint')}</small>
              )}
            </span>
          </label>
        ))}
      </div>

      <ul className="chooser-scope" role="list">
        <ScopeRow
          kind="guidance"
          label={t('portability.notebookGuidance')}
          note={tree.guidance ? undefined : t('portability.thereIsNone')}
          missing={!tree.guidance}
          frozen={frozen}
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
          frozen={frozen}
          checked={hasHistory && scope.history}
          onToggle={(on) => onScope({ ...scope, history: on })}
        />
        {(['folders', 'templates', 'notes', 'files'] as const).map((species) => {
          const held = counts[species].held;
          // Nothing travels without its folder, so the two that depend on one
          // say so instead of offering a box that would carry nothing. The
          // files depend on nothing: they belong to the notebook (#176).
          const blocked = species !== 'folders' && species !== 'files' && !scope.folders;
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
              frozen={frozen}
              checked={!missing && scope[species]}
              onToggle={(on) => onScope({ ...scope, [species]: on })}
              reach={!frozen && !missing && scope[species] ? scope.reach[species] : null}
              onReach={(reach) => {
                onScope({ ...scope, reach: { ...scope.reach, [species]: reach } });
                if (reach === 'choose') onChoose(species);
              }}
            />
          );
        })}
      </ul>
    </div>
  );
}

/** One species of the scope: a box, what it is, how much of it, and how much. */
function ScopeRow({
  kind,
  label,
  note,
  checked,
  missing,
  frozen = false,
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
  /** The whole notebook is travelling, so the row states rather than asks. */
  frozen?: boolean;
  onToggle: (on: boolean) => void;
  /** Absent on the two species that have nothing under them to walk. */
  reach?: Reach | null;
  onReach?: (next: Reach) => void;
}) {
  const { t } = useTranslation();

  return (
    <li
      className={`chooser-scope-row is-${kind}${missing ? ' is-missing' : ''}${
        frozen ? ' is-frozen' : ''
      }`}
    >
      {/* Under the whole notebook the row STATES that this travels, with a
          mark and not with a box: a box nobody can tick is a control that does
          nothing, and a disabled one draws its tick so faintly that five of
          them read as five empty squares under a choice saying everything
          goes. */}
      {frozen ? (
        <span className="chooser-label">
          <span className="chooser-mark" aria-hidden="true">
            {checked ? '✓' : ''}
          </span>
          <span className="chooser-name">{label}</span>
        </span>
      ) : (
        <label className="chooser-label">
          <input
            type="checkbox"
            checked={checked}
            disabled={missing}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="chooser-name">{label}</span>
        </label>
      )}
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
      {note !== undefined && <span className="chooser-note">{note}</span>}
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
  twins,
}: {
  tree: DocumentTree;
  species: Species;
  scope: Scope;
  chosen: Chosen;
  picked: Picked;
  onPicked: (next: Picked) => void;
  filter: string;
  onFilter: (next: string) => void;
  twins: ReadonlyArray<TwinNames>;
}) {
  const { t } = useTranslation();
  const inConflict = twinNoteIds(twins);
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
      <div className="chooser-scroll">
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
                inConflict={inConflict}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * The files, which are a list and not a tree (#176).
 *
 * There is nothing to walk: a file belongs to the notebook rather than to a
 * folder, so no folder above it can take it out and no branch can be half
 * ticked. What each row shows is what decides whether somebody wants it — the
 * name a note writes, the type and the size — and the size is why the tab
 * exists at all, since the files are usually most of what an archive weighs.
 */
function FilesPanel({
  tree,
  picked,
  onPicked,
}: {
  tree: DocumentTree;
  picked: Picked;
  onPicked: (next: Picked) => void;
}) {
  const { t } = useTranslation();

  const toggle = (name: string, on: boolean): void => {
    const next = new Set(picked.files);
    if (on) next.add(name);
    else next.delete(name);
    onPicked({ ...picked, files: next });
  };

  return (
    <>
      <p className="chooser-scoping">{t('portability.filesBelongToTheNotebook')}</p>
      <div className="chooser-scroll">
        {tree.files.length === 0 ? (
          <p className="chooser-empty">{t('portability.thereIsNone')}</p>
        ) : (
          <ul className="chooser-files" role="list" aria-label={t('portability.tab.files')}>
            {tree.files.map((file) => (
              <li key={file.name} className="chooser-file">
                <label>
                  <input
                    type="checkbox"
                    checked={picked.files.has(file.name)}
                    onChange={(event) => toggle(file.name, event.target.checked)}
                  />
                  {/* What it is called, then what it IS, then how it is drawn
                      and how much it weighs. The description leads over the
                      type because the type was never the question: a name and
                      a MIME say what a file is called and how it is shown,
                      and only the description says whether you want it. */}
                  <span className="chooser-file-body">
                    <span className="chooser-file-name">{file.name}</span>
                    {file.description.length > 0 && (
                      <span className="chooser-file-about">{file.description}</span>
                    )}
                    <span className="chooser-file-note">
                      {file.mimeType} · {readableBytes(file.bytes)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** A size a person reads, in the units a person uses. */
function readableBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * What refuses the import, all of it in a tab of its own (#161).
 *
 * The collisions were a strip above the tree of the notes, which is the one
 * place a collision is RESOLVED — so the explanation of the problem sat on top
 * of the room needed to fix it, and three of them left almost no tree. A
 * refusal is not a fifth thing to choose; it is the reason the choosing cannot
 * end, and it earns the tab it now has, lit and counted, opening only when
 * there is one to show.
 *
 * **The name already taken is a refusal like any other**, and it is here for
 * the same reason: it was a sentence under the name field, appearing and
 * disappearing as the name was typed, moving everything below it — the room
 * where what travels is chosen — down and back up under the hand of whoever
 * was typing (RN-KNW-032).
 *
 * Each row names the whole thing and offers the way out: the name, where it
 * is, and either the field that names the notebook or the tree where one of
 * two copies is let go.
 */
function ConflictsPanel({
  twins,
  nameTaken,
  onFixName,
  onFindNote,
}: {
  twins: ReadonlyArray<TwinNames>;
  nameTaken: string | null;
  onFixName?: (() => void) | undefined;
  onFindNote?: ((name: string) => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <>
      <p className="chooser-scoping">{t('portability.conflictsWhy')}</p>
      <div className="chooser-scroll">
        {nameTaken !== null && (
          <ul className="chooser-twins">
            <li className="chooser-twin">
              <span className="chooser-twin-name">
                {t('portability.nameTakenTitle', { name: nameTaken })}
              </span>
              <span className="chooser-twin-where">{t('portability.nameTakenWhy')}</span>
              {onFixName && (
                <button type="button" className="chooser-twins-open" onClick={onFixName}>
                  {t('portability.changeName')}
                </button>
              )}
            </li>
          </ul>
        )}
        {twins.length > 0 && (
          <>
            <p className="chooser-conflict-why">{t('portability.twinsWhy')}</p>
            <ul className="chooser-twins">
              {twins.map((twin) => (
                <li key={`${twin.folderId}-${twin.name}`} className="chooser-twin">
                  <span className="chooser-twin-name">{twin.name}</span>
                  <span className="chooser-twin-where">
                    {t('portability.twinWhere', { count: twin.count, folder: twin.folderName })}
                  </span>
                  {onFindNote && (
                    <button
                      type="button"
                      className="chooser-twins-open"
                      onClick={() => onFindNote(twin.name)}
                    >
                      {t('portability.findTwin')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
  conflict = false,
}: {
  kind: 'folder' | 'path' | 'template' | 'note';
  /** This note shares its name with another in its folder (RN-KNW-042). */
  conflict?: boolean;
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
        className={`chooser-row is-${kind}${conflict ? ' is-twin' : ''}`}
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
  inConflict,
}: {
  folder: OfferableFolder;
  species: Species;
  picked: Picked;
  depth: number;
  filter: string;
  onPicked: (next: Picked) => void;
  /** The notes a name collision is about, which the row says so (RN-KNW-042). */
  inConflict: ReadonlySet<string>;
}) {
  const { t, i18n } = useTranslation();
  // A branch opens collapsed below the first level, so a tree of a thousand
  // notes draws a handful of rows until somebody asks for more — but a FILTER
  // is somebody asking: what it matched may sit three levels down, and leaving
  // it behind a twisty is the same as not finding it (#161).
  const [open, setOpen] = useState(depth === 0);
  const shown = filter !== '' || open;
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
      {shown && (under.length > 0 || notes.length > 0) && (
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
              inConflict={inConflict}
            />
          ))}
          {notes.map((each) => (
            <Row
              key={each.id}
              kind="note"
              conflict={inConflict.has(each.id)}
              label={each.name || t('note.unnamed')}
              // Two notes of one name in one folder are the same row twice, so
              // the one thing that differs is shown: when each was written.
              note={
                inConflict.has(each.id) && each.updatedAt
                  ? new Intl.DateTimeFormat(intlLocale(i18n.language), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(each.updatedAt))
                  : undefined
              }
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
