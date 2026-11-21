import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { usePreferences } from '../../shared/store/preferences';
import { BarButton, NotebookBar } from '../structure/NotebookBreadcrumb';
import { GraphSkeleton } from '../../shared/components/skeletons';
import { noteAddress } from '../../shared/api/note-address';
import { folderTrailForNote } from '../structure/trail';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import {
  getNotebookActivity,
  getNotebookAttachments,
  getNotebookFiles,
  getNotebookGraph,
  getTableUses,
  listDashboards,
  listTables,
  type GraphActivityDto,
} from '../../shared/api/backend';
import type { FolderNode } from '../../shared/types/api';
import { loadedRuntimeConfig } from '../../shared/config/runtime-config';
import {
  assistantOf,
  planOf,
  resourceNodeId,
  type Assistant,
  type GraphContext,
  type Mark,
  type ResourceKind,
  type Target,
} from './activity';
import { KIND_SLOT, colorOrder, freeAttributeSlot, slotToken } from './graph-colors';
import { SIMULATED_ASSISTANTS, simulatedDelay, simulatedEvent } from './simulation';
import { CloseIcon, GearIcon, HelpIcon, PlayIcon, StopIcon } from '../../shared/components/icons';
import { GraphHelp, type HelpNode } from './GraphHelp';
import { COLLISION_GAP, linkLength, radiiOf } from './node-scale';

interface GraphFile {
  nodes: {
    id: string;
    name: string;
    folderId: string;
    facets: Record<string, string[]>;
  }[];
  edges: [number, number][];
  /**
   * What the notebook keeps besides its notes, each drawn as a node of its own
   * kind with its edges (#502): the files and the notes that embed each, the
   * tables and the notes that show each, the dashboards and the tables each
   * draws from. These edges are drawn only: they are no links, and backlinks,
   * related notes and the notebook's health never count them.
   */
  files: { id: string; name: string; notes: string[] }[];
  tables: { id: string; name: string; notes: string[] }[];
  dashboards: { id: string; name: string; tables: string[] }[];
}

/** The tables a dashboard's components draw from, by identifier, whatever names them. */
function dashboardTables(
  definition: Record<string, unknown>,
  tables: readonly { id: string; name: string }[],
): string[] {
  const components = Array.isArray(definition['components']) ? definition['components'] : [];
  const found = new Set<string>();
  for (const component of components as Array<Record<string, unknown>>) {
    const source = component?.['source'] as Record<string, unknown> | null | undefined;
    const given = typeof source?.['table'] === 'string' ? source['table'] : null;
    if (!given) continue;
    const match =
      tables.find((table) => table.id.toUpperCase() === given.toUpperCase()) ??
      tables.find((table) => sameName(table.name, given));
    if (match) found.add(match.id);
  }
  return [...found];
}

/** Two names compared as the product compares them: NFC, case folded. */
function sameName(left: string, right: string): boolean {
  return left.normalize('NFC').toLowerCase() === right.normalize('NFC').toLowerCase();
}

/** Every folder of the tree, the parent's identifier beside each. */
function allFolders(
  folders: readonly FolderNode[],
  parent: string | null = null,
): { folder: FolderNode; parent: string | null }[] {
  return folders.flatMap((folder) => [
    { folder, parent },
    ...allFolders(folder.children, folder.id),
  ]);
}

/** What the activity and the simulation place their entries on. */
function graphContextOf(data: GraphFile, folders: readonly FolderNode[]): GraphContext {
  return {
    notes: data.nodes,
    folderName: (folderId) => findFolderName(folders, folderId),
    tables: data.tables,
    dashboards: data.dashboards,
    files: data.files,
  };
}

/**
 * **A node is a NOTE, and it always was.** The identifier is the `NoteId`,
 * which is the one thing two notes with the same name do not share; the name
 * is the label, and a label may repeat (RN-DSC-047). That is the honest
 * picture: a notebook does hold two notes called `Índice`, and collapsing them
 * into one node would draw one and silently lose the other.
 *
 * What the drawing owes them is a way to tell them apart, and it is the folder
 * trail — which is what a hover writes beside the label.
 */
interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  /** Where the note lives, which is what tells two of one name apart. */
  folder: string;
  kind: 'note' | 'value' | ResourceKind;
  /** What this note says about itself; empty on any other node. */
  facets: Record<string, string[]>;
  /** Which colour slot a value or a resource node wears (#502); absent on a note. */
  slot?: number;
  degree: number;
  radius: number;
}

type GraphLink = SimulationLinkDatum<GraphNode>;

/** How often the page asks, while it is looked at, and once nothing happened for two minutes. */
const ACTIVITY_EVERY_MS = 3_000;
const ACTIVITY_QUIET_EVERY_MS = 15_000;
const ACTIVITY_QUIET_AFTER_MS = 120_000;
/** An assistant leaves the notice this long after its last activity. */
const ASSISTANT_IDLE_MS = 4_500;
/** One assistant's activities play one after the other, this far apart. */
const ACTIVITY_STEP_MS = 700;
/** How many assistants the notice names before it says how many more. */
const ASSISTANTS_SHOWN = 3;

/** A value node is keyed `attribute:value`; the foot writes it `attribute: value`. */
function pinnedLabel(id: string): string {
  const at = id.indexOf(':');
  return at < 0 ? id : `${id.slice(0, at)}: ${id.slice(at + 1)}`;
}

/**
 * How many distinct values an attribute may have and still count as discrete:
 * above this it is a label and not a category, and drawing it would add one
 * node per note instead of showing what several notes have in common.
 */
const MAX_DISCRETE_VALUES = 24;

/**
 * The length of a link between the edges of its two nodes (#275), on the whole
 * notebook and inside a held group. With two nodes at the floor it is close to
 * the 28 and 70 the links had from centre to centre; larger nodes push apart.
 */
const LINK_GAP = 20;
const HELD_LINK_GAP = 60;

/**
 * How many neighbour names a hover or a held node writes on the drawing: a
 * glance names a handful. It is a ceiling and not a promise, since names that
 * would land on one another are dropped rather than piled up.
 *
 * A held value writes no such list. Holding a group is the moment you go
 * looking through it, and eighty names frozen over eighty crowded nodes is a
 * wall to read, not a group to browse. There the pointer names one node at a
 * time: the one under it.
 */
const LABELS_HOVERED = 18;

/** A date is discrete once it is a month: one node per day is a calendar. */
const YEAR_MONTH = /^(\d{4})-(\d{2})(?:-\d{2})?(?:[T ].*)?$/;
function monthOf(value: string): string {
  const match = YEAR_MONTH.exec(value);
  return match ? `${match[1]}-${match[2]}` : value;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** An attribute of the notebook, as the graph sees it: its values, by frequency. */
interface Attribute {
  readonly name: string;
  /** Distinct values, most frequent first; dates already reduced to months. */
  readonly values: string[];
  readonly multivalued: boolean;
  readonly boolean: boolean;
  /** Every value is a date, so the values above are year-months. */
  readonly dateLike: boolean;
}

function attributesOf(nodes: GraphFile['nodes']): Attribute[] {
  const raw = new Map<string, string[]>();
  const multivalued = new Set<string>();

  for (const node of nodes) {
    for (const [facet, values] of Object.entries(node.facets)) {
      if (values.length === 0) continue;
      if (values.length > 1) multivalued.add(facet);
      const all = raw.get(facet) ?? [];
      all.push(...values);
      raw.set(facet, all);
    }
  }

  return [...raw.entries()]
    .map(([name, all]) => {
      // An attribute is a date only when every value is one; a single stray
      // word means the column is text that happens to hold some dates.
      const dateLike = all.every((value) => YEAR_MONTH.test(value));
      const byValue = new Map<string, number>();
      for (const value of all) {
        const key = dateLike ? monthOf(value) : value;
        byValue.set(key, (byValue.get(key) ?? 0) + 1);
      }
      const values = [...byValue.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([value]) => value);
      return {
        name,
        values,
        multivalued: multivalued.has(name),
        boolean:
          values.length <= 2 && values.every((value) => value === 'true' || value === 'false'),
        dateLike,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The name of a folder anywhere in the tree, or null when the tree holds none. */
function findFolderName(folders: readonly FolderNode[], folderId: string): string | null {
  for (const folder of folders) {
    if (folder.id === folderId) return folder.name;
    const inside = findFolderName(folder.children, folderId);
    if (inside !== null) return inside;
  }
  return null;
}

/** How many nodes of each kind the drawing holds, which its text alternative says (#502). */
function countsOf(nodes: readonly GraphNode[]): Record<'notes' | ResourceKindPlural, number> {
  const count = (kind: GraphNode['kind']) => nodes.filter((node) => node.kind === kind).length;
  return {
    notes: count('note'),
    folders: count('folder'),
    files: count('file'),
    tables: count('table'),
    dashboards: count('dashboard'),
  };
}
type ResourceKindPlural = 'folders' | 'files' | 'tables' | 'dashboards';

/** The sizes of the nodes, a folder, a file, a table and a dashboard measured among their own (#502). */
function radiiFor(nodes: readonly GraphNode[]): number[] {
  return radiiOf(
    nodes.map((node) => ({
      kind: node.kind === 'note' || node.kind === 'value' ? node.kind : ('resource' as const),
      degree: node.degree,
    })),
  );
}

/**
 * Whether this device answers with a finger and not a pointer. It decides which
 * gestures the hint names: telling someone to scroll a wheel they do not have
 * is worse than saying nothing.
 */
function useTouchOnly(): boolean {
  const [touchOnly, setTouchOnly] = useState(() => window.matchMedia('(hover: none)').matches);
  useEffect(() => {
    const media = window.matchMedia('(hover: none)');
    const apply = () => setTouchOnly(media.matches);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return touchOnly;
}

export function GraphPage() {
  const { t } = useTranslation();
  const touchOnly = useTouchOnly();
  const navigate = useNavigate();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  useDocumentTitle(t('graph.navLabel'), structure.notebook.name);
  /**
   * The address of a node, which is the identifier the graph draws
   * (RN-DSC-045). A note the tree the page loaded does not hold is not
   * somewhere to go: the link projection can still name a note deleted a
   * moment ago.
   */
  const addressOfNote = useCallback(
    (noteId: string): string | null =>
      folderTrailForNote(structure.folders, noteId).length > 0
        ? noteAddress(notebookId, noteId)
        : null,
    [structure, notebookId],
  );
  const theme = usePreferences((s) => s.theme);
  /** The order this notebook uses the list of colours in, the same on every visit (#502). */
  const order = useMemo(() => colorOrder(notebookId), [notebookId]);
  const slotColor = useCallback((slot: number) => `var(${slotToken(slot, order)})`, [order]);
  /** The simulation of several agents, on staging alone (#503). */
  const simulates = loadedRuntimeConfig()?.environment === 'staging';
  const [simulating, setSimulating] = useState(false);
  const [truncated, setTruncated] = useState(false);
  /**
   * The attributes whose values are drawn as nodes, each with the colour slot
   * it holds. It is a set and not a choice: every attribute is switched on by
   * itself, and one attribute is one colour, however many values it has.
   *
   * The slot is decided when the attribute is switched ON and held until it is
   * switched off, so turning one off never repaints the ones that stay.
   */
  const [drawn, setDrawn] = useState<readonly { name: string; slot: number }[]>([]);
  /**
   * The panel floats over the drawing, so it starts closed, behind the gear,
   * on every screen (#220): the graph is what the page is for, and a panel
   * that opens on top of it uncalled hides the thing the person came to look
   * at. The settings are one click away.
   */
  const [controlsOpen, setControlsOpen] = useState(false);
  /**
   * The kinds of node switched off in the Notebook section of the gear (#505):
   * every kind comes on, and the person takes one off. Off, a kind keeps the
   * colour the notebook reserved for it (RN-DSC-070).
   */
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ResourceKind>>(() => new Set());
  /** The modal that says what every animation and every node means (#507). */
  const [helpOpen, setHelpOpen] = useState(false);
  /**
   * The node held on the drawing, which the foot says (#233) with an Open
   * beside it when it leads somewhere (#515). The drawing keeps the node
   * itself; this is only what the foot needs, told to React when the hold
   * changes and never on a frame.
   */
  const [held, setHeld] = useState<{
    label: string;
    value: boolean;
    url: string | null;
  } | null>(null);
  const [data, setData] = useState<GraphFile | null>(null);
  const [failed, setFailed] = useState(false);
  /**
   * Bumped to read the graph again, when a projection says a write landed
   * (#495): the drawing keeps where every note stood across the read.
   */
  const [reads, setReads] = useState(0);
  /** The assistants working in the notebook now, newest first, and what each is doing. */
  const [assistants, setAssistants] = useState<readonly (Assistant & { doing: string })[]>([]);
  /** Plays entries as the polling does; the simulation hands its own to it (#503). */
  const handleRef = useRef<
    ((entries: readonly GraphActivityDto[], simulated?: boolean) => void) | null
  >(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    nodes: GraphNode[];
    links: GraphLink[];
    neighbors: Map<GraphNode, Set<GraphNode>>;
    sim: Simulation<GraphNode, GraphLink> | null;
    transform: { x: number; y: number; k: number };
    hovered: GraphNode | null;
    /**
     * The node held on the drawing, of any kind (#515). Hovering shows a
     * node's links for as long as the pointer stays on it, which is exactly as
     * long as it takes to move the pointer off it and lose it: the moment you
     * go for one of the neighbours it named, it is gone, and a finger has no
     * hover at all. Holding is that same highlight, kept, so the links can be
     * read; the first click or tap holds, a second one on the held node opens
     * it. While something is held the drawing stops answering to hover,
     * because a highlight that still follows the pointer is not held at all.
     */
    pinned: GraphNode | null;
    /**
     * The value whose group is on the drawing, or null for the whole notebook.
     * Holding a value holds its group; holding a note of that group then keeps
     * the group and focuses the note inside it.
     */
    scope: GraphNode | null;
    /**
     * What is on the drawing at all: the held value and its group, or null for
     * the whole notebook. A node outside it is not drawn, and is not under the
     * pointer either, which is the difference between hiding something and
     * merely fading it.
     */
    shown: Set<GraphNode> | null;
    redraw: (() => void) | null;
    /** The nodes by identifier, which the marks of the activity point at. */
    byId: Map<string, GraphNode>;
    /** What the activity of the agents draws now (#495). */
    marks: Mark[];
    /** Starts the frames the marks need, when the simulation is not ticking. */
    kick: (() => void) | null;
  }>({
    nodes: [],
    links: [],
    neighbors: new Map(),
    sim: null,
    transform: { x: 0, y: 0, k: 1 },
    hovered: null,
    pinned: null,
    scope: null,
    shown: null,
    redraw: null,
    byId: new Map(),
    marks: [],
    kick: null,
  });

  /**
   * The graph is the link projection of Discovery, and each node carries the
   * portrait the facet projection keeps of that note. The backend still does
   * not interpret content (PP4): those attributes were classified by the shape
   * of the value, so the controls below offer whatever THIS notebook declares,
   * and a notebook that declares nothing simply shows no control.
   */
  useEffect(() => {
    let live = true;
    // What the notebook keeps besides its notes (#502). A part that fails is
    // drawn without, never as a graph that could not be read.
    const files = getNotebookFiles(notebookId).catch(() => []);
    const attachments = getNotebookAttachments(notebookId).catch(() => []);
    const tables = listTables(notebookId).catch(() => []);
    const uses = getTableUses(notebookId).catch(() => []);
    const dashboards = listDashboards(notebookId).catch(() => []);
    void Promise.all([getNotebookGraph(notebookId), files, attachments, tables, uses, dashboards])
      .then(([graph, kept, shown, held, used, boards]) => {
        if (!live) return;
        const tableList = held.map((table) => ({ id: table.tableId, name: table.name }));
        setData({
          nodes: graph.nodes.map((note) => ({
            // The identifier, because two notes may carry one name and the
            // graph draws a note and never a name (RN-DSC-047).
            id: note.noteId,
            name: note.name,
            folderId: note.folderId,
            facets: note.facets ?? {},
          })),
          edges: graph.edges,
          files: kept.map((file) => ({
            id: file.fileId,
            name: file.name,
            notes:
              shown
                .find((each) => each.name.normalize('NFC') === file.name.normalize('NFC'))
                ?.notes.map((note) => note.noteId) ?? [],
          })),
          tables: tableList.map((table) => ({
            ...table,
            notes:
              used
                .find((use) => sameName(use.table, table.name))
                ?.notes.map((note) => note.noteId) ?? [],
          })),
          dashboards: boards.map((board) => ({
            id: board.dashboardId,
            name: board.name,
            tables: dashboardTables(board.definition, tableList),
          })),
        });
        setTruncated(graph.truncated);
      })
      .catch(() => {
        // A failure is not an empty notebook. Saying so is the difference between
        // "nobody has written anything" and "we could not read it". A read
        // again that fails leaves the drawing as it was.
        if (live && reads === 0) setFailed(true);
      });
    return () => {
      live = false;
    };
    // `reads` is what reads the graph again (#495).
  }, [notebookId, reads]);

  /*
    The activity of the agents (#495): asked every few seconds while the page
    is looked at, and every fifteen once nothing happened for two minutes. The
    first answer is where the page starts from, and is not played: what an
    agent did before the graph was opened is not news.
  */
  const latest = useRef({ data, drawn, structure });
  latest.current = { data, drawn, structure };
  useEffect(() => {
    let stopped = false;
    let cursor: string | null = null;
    let started = false;
    let timer = 0;
    let quietSince = Date.now();
    let rereading = 0;
    const working = new Map<
      string,
      { name: string; lastAt: number; nextAt: number; doing: string }
    >();
    const state = stateRef.current;

    const publish = () =>
      setAssistants(
        [...working.entries()]
          .sort(([, a], [, b]) => b.lastAt - a.lastAt)
          .map(([key, each]) => ({ key, name: each.name, doing: each.doing })),
      );

    const say = (target: Target): string => {
      switch (target.kind) {
        case 'note':
          return target.name ? `“${target.name}”` : t('graph.activity.aNote');
        case 'newNote':
          return t('graph.activity.newNote');
        case 'folder':
          return t('graph.activity.folder', { name: target.name });
        case 'search':
          return t('graph.activity.search', { query: target.query });
        case 'table':
        case 'dashboard':
        case 'file':
          return target.name
            ? t(`graph.activity.${target.kind}Named`, { name: target.name })
            : t(`graph.activity.${target.kind}`);
        default:
          return t(`graph.activity.${target.kind}`);
      }
    };

    function handle(entries: readonly GraphActivityDto[], simulated = false) {
      const { data: graphData, structure: tree } = latest.current;
      if (!graphData) return;
      const graph: GraphContext = graphContextOf(graphData, tree.folders);
      let said = false;
      let readAgain = false;
      const now = performance.now();
      for (const entry of entries) {
        if (entry.kind === 'projected') {
          // The projection holds the write now: the graph is read again, and
          // draws nothing, since the write was drawn already, whatever it
          // changed (#504). A simulated write changed nothing (#503).
          if (!simulated) readAgain = true;
          continue;
        }
        const assistant = assistantOf(entry);
        const plan = assistant ? planOf(entry, graph) : null;
        if (!assistant || !plan) continue;
        let held = working.get(assistant.key);
        if (!held) {
          held = { name: assistant.name, lastAt: 0, nextAt: 0, doing: '' };
          working.set(assistant.key, held);
        }
        const start = Math.max(now, held.nextAt);
        held.nextAt = start + ACTIVITY_STEP_MS;
        held.lastAt = Date.now() + (start - now);
        const target = say(plan.target);
        held.doing = t(
          plan.kind === 'write' ? 'graph.activity.writing' : 'graph.activity.reading',
          {
            target,
          },
        );

        const lit = [...plan.notes, ...plan.values.filter((id) => state.byId.has(id))];
        let far = 1;
        if (plan.wave) {
          for (const id of lit) {
            const node = state.byId.get(id);
            far = Math.max(far, Math.hypot(node?.x ?? 0, node?.y ?? 0));
          }
        }
        lit.forEach((id, index) => {
          const node = state.byId.get(id);
          const delay = plan.wave
            ? (Math.hypot(node?.x ?? 0, node?.y ?? 0) / far) * 1_100
            : lit.length > 1
              ? index * 60
              : 0;
          state.marks.push({
            kind: plan.kind,
            nodeId: id,
            start: start + delay,
            duration: plan.kind === 'write' ? 1_700 : lit.length > 1 ? 1_000 : 1_500,
          });
        });
        said = true;
      }
      if (said) publish();
      state.kick?.();
      if (readAgain) {
        window.clearTimeout(rereading);
        rereading = window.setTimeout(() => setReads((count) => count + 1), 300);
      }
    }

    handleRef.current = handle;

    async function ask() {
      if (stopped) return;
      if (!document.hidden) {
        try {
          const entries = await getNotebookActivity(notebookId, cursor);
          if (stopped) return;
          const last = entries.at(-1)?.id;
          if (last) cursor = last;
          if (started && entries.length > 0) {
            quietSince = Date.now();
            handle(entries);
          }
          started = true;
        } catch {
          // A missed answer is a missed pulse, never an error on the page.
        }
      }
      const quiet = Date.now() - quietSince > ACTIVITY_QUIET_AFTER_MS;
      timer = window.setTimeout(ask, quiet ? ACTIVITY_QUIET_EVERY_MS : ACTIVITY_EVERY_MS);
    }
    void ask();

    // An assistant that stopped gives its colour back.
    const idle = window.setInterval(() => {
      let changed = false;
      for (const [key, each] of working) {
        if (Date.now() - each.lastAt > ASSISTANT_IDLE_MS) {
          working.delete(key);
          changed = true;
        }
      }
      if (changed) publish();
    }, 1_000);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(rereading);
      window.clearInterval(idle);
      handleRef.current = null;
      state.marks = [];
      setAssistants([]);
    };
  }, [notebookId, t]);

  /*
    The simulation of several agents (#503), on staging alone: each assistant
    draws an event every one to three seconds, all at once, and hands it to the
    same handler the polling feeds, so the drawing and the notice are exactly
    what real activity makes. Nothing is sent to the server.
  */
  useEffect(() => {
    if (!simulates || !simulating) return;
    const timers = new Set<number>();
    let sequence = 0;
    const later = (ms: number, run: () => void) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
    };
    for (const who of SIMULATED_ASSISTANTS) {
      const step = () => {
        const { data: graphData, structure: tree } = latest.current;
        if (graphData) {
          sequence += 1;
          const event = simulatedEvent(
            graphContextOf(graphData, tree.folders),
            who,
            Math.random,
            sequence,
          );
          if (event) handleRef.current?.(event.entries, true);
        }
        later(simulatedDelay(Math.random), step);
      };
      later(simulatedDelay(Math.random) / 2, step);
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [simulates, simulating]);

  const attributes = useMemo(() => (data ? attributesOf(data.nodes) : []), [data]);
  /**
   * What can be drawn is what is discrete: a list the note carries several of,
   * a true/false, a date reduced to its month, or any attribute with few
   * enough distinct values to be a category rather than a label.
   */
  const drawable = useMemo(
    () =>
      attributes.filter(
        (each) =>
          each.multivalued ||
          each.boolean ||
          each.dateLike ||
          each.values.length <= MAX_DISCRETE_VALUES,
      ),
    [attributes],
  );
  const dateLike = useMemo(
    () => new Set(attributes.filter((each) => each.dateLike).map((each) => each.name)),
    [attributes],
  );

  // An attribute that stops existing (another notebook, a rebuilt projection)
  // must not leave a switch pointing at nothing.
  useEffect(() => {
    setDrawn((current) => {
      const kept = current.filter((each) => drawable.some((one) => one.name === each.name));
      // Same array when nothing was dropped, or this would never settle.
      return kept.length === current.length ? current : kept;
    });
  }, [drawable]);

  function toggleDrawn(name: string) {
    setDrawn((current) => {
      if (current.some((each) => each.name === name)) {
        return current.filter((each) => each.name !== name);
      }
      // The lowest free slot after the kinds of node (#502), so switching one
      // off frees its colour for the next attribute instead of shifting
      // everyone along.
      return [...current, { name, slot: freeAttributeSlot(current.map((each) => each.slot)) }];
    });
  }

  const filtered = useMemo(() => {
    if (!data) return null;
    const folderNameOf = (noteId: string): string => {
      const trail = folderTrailForNote(structure.folders, noteId);
      return trail[trail.length - 1]?.name ?? '';
    };
    const nodes: GraphNode[] = data.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      folder: folderNameOf(n.id),
      kind: 'note' as const,
      facets: n.facets,
      degree: 0,
      radius: 3,
    }));

    const links: { source: number; target: number }[] = [];
    for (const [source, target] of data.edges) {
      if (source >= nodes.length || target >= nodes.length) continue;
      links.push({ source, target });
      const from = nodes[source];
      const to = nodes[target];
      if (from) from.degree += 1;
      if (to) to.degree += 1;
    }

    /*
      What the notebook keeps besides its notes, each a node of its own kind in
      its colour (#502): its folders, with an edge to each note and subfolder,
      its files and the notes embedding each, its tables and the notes showing
      each, its dashboards and the tables each draws from. One kept with no
      edge is drawn alone. These edges are drawn only and size nothing but the
      resource: a note keeps the size its links give it.
    */
    const indexOfNote = new Map(data.nodes.map((note, index) => [note.id, index]));
    const indexOfResource = new Map<string, number>();
    const addResource = (kind: ResourceKind, id: string, name: string) => {
      const key = resourceNodeId(kind, id);
      indexOfResource.set(key, nodes.length);
      nodes.push({
        id: key,
        name,
        folder: '',
        kind,
        facets: {},
        slot: KIND_SLOT[kind],
        degree: 0,
        radius: 3,
      });
    };
    const edge = (from: number | undefined, to: number | undefined) => {
      if (from === undefined || to === undefined) return;
      links.push({ source: from, target: to });
      for (const at of [from, to]) {
        const node = nodes[at];
        if (node && node.kind !== 'note') node.degree += 1;
      }
    };
    const folders = hiddenKinds.has('folder') ? [] : allFolders(structure.folders);
    for (const { folder } of folders) addResource('folder', folder.id, folder.name);
    for (const { folder, parent } of folders) {
      if (parent) {
        edge(
          indexOfResource.get(resourceNodeId('folder', parent)),
          indexOfResource.get(resourceNodeId('folder', folder.id)),
        );
      }
    }
    data.nodes.forEach((note, index) =>
      edge(indexOfResource.get(resourceNodeId('folder', note.folderId)), index),
    );
    for (const file of hiddenKinds.has('file') ? [] : data.files) {
      addResource('file', file.id, file.name);
      const at = indexOfResource.get(resourceNodeId('file', file.id));
      for (const noteId of file.notes) edge(indexOfNote.get(noteId), at);
    }
    for (const table of hiddenKinds.has('table') ? [] : data.tables) {
      addResource('table', table.id, table.name);
      const at = indexOfResource.get(resourceNodeId('table', table.id));
      for (const noteId of table.notes) edge(indexOfNote.get(noteId), at);
    }
    for (const dashboard of hiddenKinds.has('dashboard') ? [] : data.dashboards) {
      addResource('dashboard', dashboard.id, dashboard.name);
      const at = indexOfResource.get(resourceNodeId('dashboard', dashboard.id));
      for (const tableId of dashboard.tables) {
        edge(at, indexOfResource.get(resourceNodeId('table', tableId)));
      }
    }

    // The values of the switched-on attributes, drawn as nodes: this is what
    // makes a tag visible as the thing several notes have in common, rather
    // than a word repeated in their frontmatter. The map is keyed by attribute
    // AND value, because `type: guide` and `tags: guide` are two facts.
    const indexOfValue = new Map<string, number>();
    for (const { name: attribute, slot } of drawn) {
      const asMonth = dateLike.has(attribute);
      data.nodes.forEach((note, noteIndex) => {
        for (const raw of note.facets[attribute] ?? []) {
          const value = asMonth ? monthOf(raw) : raw;
          const key = `${attribute}:${value}`;
          let at = indexOfValue.get(key);
          if (at === undefined) {
            at = nodes.length;
            indexOfValue.set(key, at);
            nodes.push({
              id: key,
              name: value,
              // A value node lives in no folder: it is what the notebook says
              // about its notes, not one of them.
              folder: '',
              kind: 'value',
              facets: {},
              slot,
              degree: 0,
              radius: 3,
            });
          }
          links.push({ source: noteIndex, target: at });
          const note0 = nodes[noteIndex];
          const value0 = nodes[at];
          if (note0) note0.degree += 1;
          if (value0) value0.degree += 1;
        }
      });
    }

    // Both grow with how much they hold, relative to the nodes drawn (#275),
    // and a value node starts larger: it is the thing you aim at to hold its
    // group, and a target has to be hittable.
    const radii = radiiFor(nodes);
    nodes.forEach((node, index) => {
      node.radius = radii[index] ?? node.radius;
    });
    return { nodes, links };
  }, [data, drawn, dateLike, structure, hiddenKinds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filtered) return;
    const state = stateRef.current;
    state.sim?.stop();

    const parent = canvas.parentElement;
    let width = parent?.clientWidth ?? 900;
    let height = parent?.clientHeight ?? 640;
    let dpr = window.devicePixelRatio || 1;
    function sizeCanvas() {
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
    }
    sizeCanvas();

    /*
      A read again keeps the drawing (#495): every node that was there stays
      where it stood, still, and one that is new starts beside the first node
      it links to, so a note an agent creates comes in among the notes it cites
      and nothing else jumps. Only the first read lays the graph from nothing.
    */
    const previous = new Map(state.nodes.map((node) => [node.id, node]));
    const pinnedBefore = state.pinned?.id ?? null;
    const scopeBefore = state.scope?.id ?? null;
    const nodes: GraphNode[] = filtered.nodes.map((n) => {
      const was = previous.get(n.id);
      return was?.x !== undefined && was.y !== undefined
        ? { ...n, x: was.x, y: was.y, vx: 0, vy: 0 }
        : { ...n };
    });
    const kept = nodes.some((node) => node.x !== undefined);
    if (kept) {
      for (const { source, target } of filtered.links) {
        const [from, to] = [nodes[source], nodes[target]];
        if (!from || !to) continue;
        const [placed, unplaced] = from.x === undefined ? [to, from] : [from, to];
        if (placed.x === undefined || unplaced.x !== undefined) continue;
        unplaced.x = placed.x + placed.radius + 8 + Math.random() * 6;
        unplaced.y = (placed.y ?? 0) - placed.radius - 6 - Math.random() * 6;
      }
    }
    const links: GraphLink[] = filtered.links.map((l) => ({ ...l }));
    state.nodes = nodes;
    state.links = links;
    state.byId = new Map(nodes.map((node) => [node.id, node]));
    if (!kept) {
      state.transform = {
        x: width / 2,
        y: height / 2,
        k: Math.min(1, 600 / Math.sqrt(nodes.length) / 12),
      };
    }
    state.hovered = null;
    // The nodes were just rebuilt, so a hold from the previous drawing points
    // at an object that is no longer on it; it is held again below when the
    // node is still there.
    state.pinned = null;
    state.scope = null;
    state.shown = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx) return;
      const { x, y, k } = state.transform;
      const colors = {
        note: cssVar('--accent') || '#0f56d7',
        edge: cssVar('--text-soft') || '#6f6d64',
        label: cssVar('--text') || '#26251f',
        halo: cssVar('--bg') || '#fafaf8',
        activity: cssVar('--signal') || '#ff8a2b',
      };
      // One colour per kind and per attribute, whatever its values (#502): a
      // tag node and a month node say which attribute they came from, a table
      // node that it is a table, not which one.
      const fills = new Map<number, string>();
      function nodeFill(node: GraphNode): string {
        if (node.kind === 'note' || node.slot === undefined) return colors.note;
        let fill = fills.get(node.slot);
        if (fill === undefined) {
          fill = cssVar(slotToken(node.slot, order)) || colors.label;
          fills.set(node.slot, fill);
        }
        return fill;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(x, y);
      ctx.scale(k, k);

      // A hold outranks the pointer: while one is held, moving the mouse across
      // the drawing never changes WHICH node is lit, which is the whole point
      // of holding it. The pointer keeps one job, naming what is under it.
      const pinned = state.pinned;
      const hovered = state.hovered;
      const focus = pinned ?? hovered;
      const neighborSet = focus ? state.neighbors.get(focus) : null;
      // With a group held there is nothing else on the drawing to fade: the
      // rest of the notebook is not drawn at all.
      const shown = state.shown;

      ctx.globalAlpha = focus ? 0.06 : 0.14;
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      for (const link of state.links) {
        const s = link.source as GraphNode;
        const tN = link.target as GraphNode;
        // Inside a held group, the links BETWEEN its notes are drawn too: what
        // an attribute gathers is worth seeing as a shape, not only as spokes.
        if (shown ? !shown.has(s) || !shown.has(tN) : focus && s !== focus && tN !== focus)
          continue;
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(tN.x ?? 0, tN.y ?? 0);
      }
      ctx.stroke();

      if (focus) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (const link of state.links) {
          const s = link.source as GraphNode;
          const tN = link.target as GraphNode;
          if (s !== focus && tN !== focus) continue;
          // A note focused inside a held group reaches only what is drawn.
          if (shown && (!shown.has(s) || !shown.has(tN))) continue;
          ctx.moveTo(s.x ?? 0, s.y ?? 0);
          ctx.lineTo(tN.x ?? 0, tN.y ?? 0);
        }
        ctx.stroke();
      }

      for (const node of state.nodes) {
        if (shown && !shown.has(node)) continue;
        // Whatever the pointer is on is never dimmed: it is about to be named,
        // and a name over a faded dot reads as a mistake.
        const dimmed = focus && node !== focus && node !== hovered && !neighborSet?.has(node);
        ctx.globalAlpha = dimmed ? 0.15 : 1;
        ctx.fillStyle = nodeFill(node);
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      drawMarks(colors);

      // The ring around the pinned node, so the drawing says whether this
      // group is being held or merely pointed at. It is drawn in ink and not
      // in the attribute's own colour, which would be a ring the same shade as
      // the disc it surrounds.
      if (pinned) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colors.label;
        ctx.lineWidth = 1.5 / k;
        ctx.beginPath();
        ctx.arc(pinned.x ?? 0, pinned.y ?? 0, pinned.radius + 3.5 / k, 0, Math.PI * 2);
        ctx.stroke();
      }

      /*
        Who gets named. With a value held, only the value and whatever the
        pointer is on: the highlight stays put and the pointer reads the group
        one node at a time, which is how you look for a note among many. Any
        other node, hovered or held, names itself and its neighbours (#515):
        on a touch screen holding is the only way a note is ever named. With
        nothing in focus the drawing names nothing (#499): the names it wrote
        of the most linked notes cluttered the graph it opens on.
      */
      const under = hovered && hovered !== focus ? [hovered] : [];
      const labelTargets = !focus
        ? []
        : focus.kind === 'value' && focus === pinned
          ? [focus, ...under]
          : [focus, ...(neighborSet ? [...neighborSet].slice(0, LABELS_HOVERED) : []), ...under];
      ctx.globalAlpha = 1;
      const fontSize = Math.max(10 / k, 4);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      /*
        A name that lands on another name leaves two unreadable names, and a
        held group is dozens of nodes crowded into the space of a few. So the
        boxes already written are kept, and a name that would overlap one of
        them is skipped rather than piled on top of it: the drawing shows fewer
        names than it has, and every name it shows can be read. Order decides
        who wins, and the focused node is first in the list.
      */
      const written: { x0: number; y0: number; x1: number; y1: number }[] = [];
      for (const node of labelTargets) {
        // A neighbour outside the held group is not on the drawing to name.
        if (shown && !shown.has(node)) continue;
        // The focused node names the folder it lives in, which is what makes
        // two nodes carrying one name distinguishable without clicking
        // either of them (RN-DSC-047).
        const label =
          node === focus && node.kind === 'note' && node.folder
            ? `${node.name} · ${node.folder}`
            : node.name;
        const lx = (node.x ?? 0) + node.radius + 3 / k;
        const ly = node.y ?? 0;
        const box = {
          x0: lx,
          y0: ly - fontSize / 2,
          x1: lx + ctx.measureText(label).width,
          y1: ly + fontSize / 2,
        };
        const collides = written.some(
          (each) => box.x0 < each.x1 && box.x1 > each.x0 && box.y0 < each.y1 && box.y1 > each.y0,
        );
        if (collides) continue;
        written.push(box);
        ctx.lineWidth = 3 / k;
        ctx.strokeStyle = colors.halo;
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = colors.label;
        ctx.fillText(label, lx, ly);
      }
    }

    /*
      What the agents do, over the drawing (#495). A read is one thin outline
      opening from the note; a write is a double outline pulsing on it, with
      strokes running out along its links, whatever it changed, and nothing
      written under it (#504). Nothing is filled: a filled disc is a node,
      and an attribute's value most of all. Every mark is orange, whoever the
      assistant (#502). With reduced motion the marks stand still and fade, and
      nothing runs.
    */
    function drawMarks(colors: { activity: string; halo: string }) {
      if (!ctx || state.marks.length === 0) return;
      const now = performance.now();
      state.marks = state.marks.filter((mark) => now < mark.start + mark.duration);
      const still = reduced.matches;
      const k = state.transform.k;
      const shown = state.shown;
      const ordered = [...state.marks].sort(
        (a, b) => (a.kind === 'write' ? 1 : 0) - (b.kind === 'write' ? 1 : 0),
      );
      for (const mark of ordered) {
        if (now < mark.start) continue;
        const node = state.byId.get(mark.nodeId);
        if (!node || (shown && !shown.has(node))) continue;
        const p = Math.min(1, (now - mark.start) / mark.duration);
        const nx = node.x ?? 0;
        const ny = node.y ?? 0;
        const color = colors.activity;
        ctx.strokeStyle = color;
        if (mark.kind === 'read') {
          ctx.globalAlpha = still ? 1 - p * 0.7 : 1 - p;
          ctx.lineWidth = 1.5 / k;
          ctx.beginPath();
          ctx.arc(nx, ny, node.radius + (still ? 4 : 3 + p * 14) / k, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
        const pulse = still ? 0 : Math.sin(p * Math.PI * 3) * 1.5;
        ctx.globalAlpha = 1 - p * p;
        ctx.lineWidth = 2 / k;
        for (const gap of [3, 6.5]) {
          ctx.beginPath();
          ctx.arc(nx, ny, node.radius + (gap + pulse) / k, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (!still) {
          const head = Math.min(1, p * 1.4);
          const tail = Math.max(0, head - 0.2);
          ctx.lineWidth = 1.5 / k;
          ctx.beginPath();
          for (const other of state.neighbors.get(node) ?? []) {
            if (shown && !shown.has(other)) continue;
            const dx = (other.x ?? 0) - nx;
            const dy = (other.y ?? 0) - ny;
            ctx.moveTo(nx + dx * tail, ny + dy * tail);
            ctx.lineTo(nx + dx * head, ny + dy * head);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    /** The frames the marks need while the simulation is at rest. */
    let frame = 0;
    function animate() {
      frame = 0;
      draw();
      if (state.marks.length > 0) frame = requestAnimationFrame(animate);
    }
    state.kick = () => {
      if (!frame) frame = requestAnimationFrame(animate);
    };

    // Held apart so holding a group can retune them: a group of forty in an
    // empty field wants more room between its nodes than one of six hundred.
    // A link is measured between the edges of its nodes (#275), so two large
    // ones are not drawn on top of each other.
    const lengthOf = (gap: number) => (link: GraphLink) =>
      linkLength(gap, link.source as GraphNode, link.target as GraphNode);
    const linkForce = forceLink<GraphNode, GraphLink>(links)
      .distance(lengthOf(LINK_GAP))
      .strength(0.4);
    const chargeForce = forceManyBody().strength(-24);
    // And no dot covers another once the drawing settles (#275).
    const collideForce = forceCollide<GraphNode>((node) => node.radius + COLLISION_GAP);

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', linkForce)
      .force('charge', chargeForce)
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .force('collide', collideForce)
      .on('tick', draw);
    // A read again only settles what moved; the first lays the whole graph.
    if (kept) sim.alpha(0.15);
    state.sim = sim;
    state.redraw = draw;

    const neighbors = new Map<GraphNode, Set<GraphNode>>();
    for (const link of links) {
      const s = link.source as GraphNode;
      const tN = link.target as GraphNode;
      if (!neighbors.has(s)) neighbors.set(s, new Set());
      if (!neighbors.has(tN)) neighbors.set(tN, new Set());
      neighbors.get(s)?.add(tN);
      neighbors.get(tN)?.add(s);
    }
    state.neighbors = neighbors;

    /**
     * Holding a group takes the rest of the notebook OFF the drawing, and lets go
     * puts it back. Dimming was not enough: a node you cannot see still
     * answered the pointer, so the drawing offered notes it was hiding.
     *
     * The simulation is rescoped to the group rather than rebuilt, so the
     * nodes keep the positions they already had and open out from where they
     * stood instead of jumping. With the crowd gone they have room, and the
     * forces are widened to use it: this is the animation that spreads a group
     * out far enough to pick one note out of it.
     */
    function rescope() {
      const held = state.scope;
      if (held) {
        const group = state.neighbors.get(held) ?? new Set<GraphNode>();
        const shown = new Set<GraphNode>([held, ...group]);
        state.shown = shown;
        // The sizes are measured again among the group (#275): against the
        // whole notebook, the group of a minor value would draw every note at
        // the floor.
        sizeAmong([...shown]);
        linkForce.links(
          state.links.filter(
            (link) => shown.has(link.source as GraphNode) && shown.has(link.target as GraphNode),
          ),
        );
        linkForce.distance(lengthOf(HELD_LINK_GAP));
        chargeForce.strength(-160);
        sim.nodes([...shown]);
        // The group is pulled to the origin of the drawing, so the view is put
        // back over the origin: otherwise a graph someone had dragged aside
        // opens its group off screen.
        state.transform.x = width / 2;
        state.transform.y = height / 2;
      } else {
        state.shown = null;
        sizeAmong(state.nodes);
        linkForce.links(state.links);
        linkForce.distance(lengthOf(LINK_GAP));
        chargeForce.strength(-24);
        sim.nodes(state.nodes);
      }
      sim.alpha(0.7).restart();
    }

    /** Sizes these nodes among themselves; the collision reads them again on `sim.nodes`. */
    function sizeAmong(over: GraphNode[]) {
      const radii = radiiFor(over);
      over.forEach((node, index) => {
        node.radius = radii[index] ?? node.radius;
      });
      collideForce.radius((node) => node.radius + COLLISION_GAP);
    }

    /**
     * Where a node leads: a note to the note, a folder to the folder, a table
     * and a dashboard to their page opened on them, a file to the files (#502).
     */
    function addressOf(node: GraphNode): string | null {
      const id = node.id.slice(node.id.indexOf('/') + 1);
      const base = `/notebooks/${notebookId}`;
      switch (node.kind) {
        case 'note':
          return addressOfNote(node.id);
        case 'folder':
          return `${base}/folders/${id}`;
        case 'table':
          return `${base}/tables?table=${encodeURIComponent(node.name)}`;
        case 'dashboard':
          return `${base}/dashboards?dashboard=${encodeURIComponent(node.name)}`;
        case 'file':
          return `${base}/attachments`;
        default:
          return null;
      }
    }

    function toGraphSpace(event: { clientX: number; clientY: number }) {
      const rect = canvas!.getBoundingClientRect();
      const { x, y, k } = state.transform;
      return { gx: (event.clientX - rect.left - x) / k, gy: (event.clientY - rect.top - y) / k };
    }

    /**
     * What is under this point, answering with what the eye says is there.
     * Value and resource nodes are painted over the notes, so one under the
     * pointer wins even when a note's centre sits closer: picking by distance
     * alone opens a note the person cannot see instead of the node they aimed
     * at. Within one kind, the nearest centre wins.
     */
    function hitTest(gx: number, gy: number): GraphNode | null {
      let best: GraphNode | null = null;
      let bestDist = Infinity;
      for (const node of state.nodes) {
        if (state.shown && !state.shown.has(node)) continue;
        const dx = (node.x ?? 0) - gx;
        const dy = (node.y ?? 0) - gy;
        const dist = dx * dx + dy * dy;
        const hit = Math.max(node.radius + 4 / state.transform.k, 6 / state.transform.k);
        if (dist >= hit * hit) continue;
        const rank = (each: GraphNode) =>
          each.kind === 'value' ? 2 : each.kind === 'note' ? 0 : 1;
        const outranks =
          best === null ||
          rank(node) > rank(best) ||
          (rank(node) === rank(best) && dist < bestDist);
        if (!outranks) continue;
        best = node;
        bestDist = dist;
      }
      return best;
    }

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = false;

    /** Zoom around a point of the canvas, wherever the gesture came from. */
    function zoomAt(mx: number, my: number, factor: number) {
      const tr = state.transform;
      const nk = Math.min(6, Math.max(0.08, tr.k * factor));
      tr.x = mx - ((mx - tr.x) / tr.k) * nk;
      tr.y = my - ((my - tr.y) / tr.k) * nk;
      tr.k = nk;
      draw();
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY < 0 ? 1.15 : 1 / 1.15,
      );
    }
    function onDown(event: MouseEvent) {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
    }
    function onMove(event: MouseEvent) {
      if (dragging) {
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        state.transform.x += dx;
        state.transform.y += dy;
        lastX = event.clientX;
        lastY = event.clientY;
        draw();
        return;
      }
      const { gx, gy } = toGraphSpace(event);
      const hit = hitTest(gx, gy);
      if (hit === state.hovered) return;
      state.hovered = hit;
      canvas!.style.cursor = hit ? 'pointer' : 'grab';
      // Always repaints: with nothing held the hover moves the highlight, and
      // with a group held it moves the one name on the drawing.
      draw();
    }
    /**
     * What the foot says of a held node: a note with its folder, a value as
     * `attribute: value`, and where an Open beside it leads (#515).
     */
    function heldOf(node: GraphNode) {
      const value = node.kind === 'value';
      return {
        label: value
          ? pinnedLabel(node.id)
          : node.kind === 'note' && node.folder
            ? `${node.name} · ${node.folder}`
            : node.name,
        value,
        url: value ? null : addressOf(node),
      };
    }
    /**
     * Holds this node, or lets go with null. A value brings its group onto the
     * drawing; a node of that group keeps the group and is focused inside it;
     * anything else is focused over the whole notebook.
     */
    function hold(next: GraphNode | null) {
      const scope =
        next?.kind === 'value' ? next : next && state.shown?.has(next) ? state.scope : null;
      state.pinned = next;
      setHeld(next ? heldOf(next) : null);
      if (scope === state.scope) {
        draw();
        return;
      }
      state.scope = scope;
      rescope();
    }
    /**
     * What a click or a tap means (#515), the same for the mouse and the
     * finger. The first one on a node holds it, so its links and its
     * neighbours' names stay on the drawing; a second one on the held node
     * opens it, which makes a double click open too. A value has nothing to
     * open, so the second one lets its group go. Another node moves the hold
     * to it, and empty canvas is how you let go without aiming at anything.
     */
    function press(hit: GraphNode | null) {
      if (hit && hit === state.pinned) {
        if (hit.kind === 'value') {
          hold(null);
          return;
        }
        const url = addressOf(hit);
        if (url) void navigate(url);
        return;
      }
      if (hit === state.pinned) return;
      hold(hit);
    }
    function onUp(event: MouseEvent) {
      dragging = false;
      if (moved) return;
      const { gx, gy } = toGraphSpace(event);
      press(hitTest(gx, gy));
    }
    /** The pointer leaving takes the hover with it, and never the hold: the
        held node survives the trip to the panel and back. */
    function onLeave() {
      dragging = false;
      if (!state.hovered) return;
      state.hovered = null;
      draw();
    }

    /**
     * Touch. One finger drags the graph, two pinch it, and a finger that lands
     * and lifts without travelling is a tap, which means what a click means.
     * There is no hover to keep: a finger is either touching or it is not, so
     * holding is the ONLY way a touch screen ever sees a node's links and
     * names (#515).
     */
    let panningTouch = false;
    let pinchGap = 0;
    function gapBetween(touches: TouchList): number {
      const [a, b] = [touches[0]!, touches[1]!];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 1) {
        panningTouch = true;
        moved = false;
        lastX = event.touches[0]!.clientX;
        lastY = event.touches[0]!.clientY;
        return;
      }
      // A pinch is never a tap, whatever the fingers do next.
      panningTouch = false;
      moved = true;
      if (event.touches.length === 2) pinchGap = gapBetween(event.touches);
    }
    function onTouchMove(event: TouchEvent) {
      // The canvas owns this gesture; without it the page scrolls instead.
      event.preventDefault();
      if (event.touches.length >= 2) {
        const gap = gapBetween(event.touches);
        if (pinchGap > 0 && gap > 0) {
          const rect = canvas!.getBoundingClientRect();
          const [a, b] = [event.touches[0]!, event.touches[1]!];
          zoomAt(
            (a.clientX + b.clientX) / 2 - rect.left,
            (a.clientY + b.clientY) / 2 - rect.top,
            gap / pinchGap,
          );
        }
        pinchGap = gap;
        return;
      }
      if (!panningTouch || event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const dx = touch.clientX - lastX;
      const dy = touch.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      state.transform.x += dx;
      state.transform.y += dy;
      lastX = touch.clientX;
      lastY = touch.clientY;
      draw();
    }
    function onTouchEnd(event: TouchEvent) {
      const wasTap = panningTouch && !moved && event.touches.length === 0;
      panningTouch = false;
      pinchGap = 0;
      if (!wasTap) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      // The browser follows a tap with a click of its own, which would land on
      // the node just held and open it: the tap is the only press there is.
      event.preventDefault();
      const { gx, gy } = toGraphSpace(touch);
      press(hitTest(gx, gy));
    }

    // What was held before the read again is held again, if it is still
    // there: the group of a value first, then the node focused inside it.
    const scopeAgain = scopeBefore ? state.byId.get(scopeBefore) : undefined;
    const pinnedAgain = pinnedBefore ? state.byId.get(pinnedBefore) : undefined;
    if (scopeAgain?.kind === 'value') {
      state.scope = scopeAgain;
      rescope();
    }
    // `rescope` may have set what is shown, which the narrowing above cannot see.
    const shownAgain = state.shown as Set<GraphNode> | null;
    if (pinnedAgain && (!shownAgain || shownAgain.has(pinnedAgain))) {
      state.pinned = pinnedAgain;
      setHeld(heldOf(pinnedAgain));
    } else {
      setHeld(null);
    }
    if (state.marks.length > 0) state.kick();

    const resize = new ResizeObserver(() => {
      const w = parent?.clientWidth ?? width;
      const h = parent?.clientHeight ?? height;
      if (w === width && h === height) return;
      width = w;
      height = h;
      dpr = window.devicePixelRatio || 1;
      sizeCanvas();
      draw();
    });
    if (parent) resize.observe(parent);

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      sim.stop();
      cancelAnimationFrame(frame);
      state.kick = null;
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      resize.disconnect();
    };
    // The theme dependency re-runs the effect so the canvas repaints with the
    // active token values.
  }, [filtered, navigate, notebookId, theme, order]);

  /** The kinds this notebook has, which the Notebook section offers (#505). */
  const kinds = useMemo((): ResourceKind[] => {
    if (!data) return [];
    const has: Record<ResourceKind, boolean> = {
      folder: allFolders(structure.folders).length > 0,
      file: data.files.length > 0,
      table: data.tables.length > 0,
      dashboard: data.dashboards.length > 0,
    };
    return (['folder', 'file', 'table', 'dashboard'] as const).filter((kind) => has[kind]);
  }, [data, structure]);

  function toggleKind(kind: ResourceKind) {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  /** What the help says of the nodes, in the colours this notebook gives them (#507). */
  const helpNodes = useMemo((): HelpNode[] => {
    const kindNodes = kinds.map((kind) => ({
      key: kind,
      label: t(`graph.kinds.${kind}`),
      color: slotColor(KIND_SLOT[kind]),
      meaning: t(`graph.help.kind.${kind}`),
    }));
    const properties = drawn.length
      ? drawn.map((each) => ({
          key: `property:${each.name}`,
          label: each.name,
          color: slotColor(each.slot),
          meaning: t('graph.help.kind.property'),
        }))
      : [
          {
            key: 'property',
            label: t('graph.propertiesSection'),
            color: null,
            meaning: t('graph.help.kind.propertyOff'),
          },
        ];
    return [
      {
        key: 'note',
        label: t('graph.help.kind.noteLabel'),
        color: 'var(--accent)',
        meaning: t('graph.help.kind.note'),
      },
      ...kindNodes,
      ...properties,
      {
        key: 'none',
        label: t('graph.help.kind.noneLabel'),
        color: 'var(--graph-none)',
        meaning: t('graph.help.kind.none'),
      },
    ];
  }, [kinds, drawn, slotColor, t]);

  return (
    <div className="graph-page">
      {/* The trail names the screen (#225). Everything that steers the
          drawing lives over the drawing. */}
      <NotebookBar crumbs={[{ label: t('graph.heading') }]}>
        {simulates ? (
          <BarButton
            icon={simulating ? <StopIcon /> : <PlayIcon />}
            label={t(simulating ? 'graph.stopSimulation' : 'graph.simulate')}
            onClick={() => setSimulating((on) => !on)}
          />
        ) : null}
      </NotebookBar>
      <div className="graph-canvas-wrap">
        {failed && <p className="status">{t('errors.unexpected')}</p>}
        {!failed && !filtered && <GraphSkeleton />}
        {filtered?.nodes.length === 0 && <p className="status">{t('graph.empty')}</p>}
        {/* The drawing says in words what it holds, by kind (#502). */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={filtered ? t('graph.summary', countsOf(filtered.nodes)) : undefined}
        />
        <div className="graph-overlay">
          {/*
            Both sections are built from what this notebook has (#505): the
            kinds of node it keeps and the properties its notes declare, so a
            switch never steers nothing. The notes are always there to be said,
            so the gear always is (#511).
          */}
          {controlsOpen ? (
            <section className="graph-panel" aria-label={t('graph.controls')}>
              <header className="graph-panel-head">
                <h2>{t('graph.notebookSection')}</h2>
                <button
                  type="button"
                  className="graph-panel-close"
                  aria-label={t('graph.closeControls')}
                  onClick={() => setControlsOpen(false)}
                >
                  <CloseIcon />
                </button>
              </header>
              <div className="graph-panel-body">
                {/*
                    The Notebook section: the notes in their blue, always drawn
                    and so with no switch (#511), then the kinds of node this
                    notebook keeps besides them, on when the graph opens (#505).
                    A switch that is on wears the colour its row brings (#511).
                  */}
                <div className="graph-switches">
                  <div className="graph-switch is-static">
                    <span
                      className="graph-switch-dot is-on"
                      style={{ background: 'var(--accent)' }}
                    />
                    <span className="graph-switch-name">{t('graph.kinds.note')}</span>
                  </div>
                  {kinds.map((kind) => {
                    const on = !hiddenKinds.has(kind);
                    const color = slotColor(KIND_SLOT[kind]);
                    return (
                      <label key={kind} className="graph-switch">
                        <span
                          className={`graph-switch-dot${on ? ' is-on' : ''}`}
                          style={on ? { background: color } : undefined}
                        />
                        <span className="graph-switch-name">{t(`graph.kinds.${kind}`)}</span>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={on}
                          style={{ '--switch-on': color } as CSSProperties}
                          onChange={() => toggleKind(kind)}
                        />
                      </label>
                    );
                  })}
                </div>
                {/*
                    The Properties section: whatever THIS notebook declares as
                    discrete, and nothing else, off when the graph opens. The
                    backend still does not interpret content: these were
                    classified by the shape of the value.
                  */}
                {drawable.length > 0 ? (
                  <>
                    <h2 className="graph-panel-section">{t('graph.propertiesSection')}</h2>
                    <div className="graph-switches">
                      {drawable.map((attribute) => {
                        const on = drawn.find((each) => each.name === attribute.name);
                        return (
                          <label key={attribute.name} className="graph-switch">
                            <span
                              className={`graph-switch-dot${on ? ' is-on' : ''}`}
                              style={on ? { background: slotColor(on.slot) } : undefined}
                            />
                            <span className="graph-switch-name">{attribute.name}</span>
                            <input
                              type="checkbox"
                              role="switch"
                              checked={on !== undefined}
                              style={
                                on
                                  ? ({ '--switch-on': slotColor(on.slot) } as CSSProperties)
                                  : undefined
                              }
                              onChange={() => toggleDrawn(attribute.name)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : (
            <button
              type="button"
              className="graph-overlay-button"
              aria-label={t('graph.openControls')}
              onClick={() => setControlsOpen(true)}
            >
              <GearIcon />
            </button>
          )}
          {/* What every animation and every node means, under the gear (#507). */}
          <button
            type="button"
            className="graph-overlay-button"
            aria-label={t('graph.help.open')}
            title={t('graph.help.open')}
            onClick={() => setHelpOpen(true)}
          >
            <HelpIcon />
          </button>
        </div>
        {/*
          Who is working in the notebook now (#495): one line per assistant,
          the newest first, beside the orange every mark of the activity wears
          (#502). A log of the last activities was taken away by the owner: the
          drawing and this notice say it.
        */}
        {assistants.length > 0 ? (
          <div className="graph-activity" role="status" aria-live="polite">
            {assistants.slice(0, ASSISTANTS_SHOWN).map((assistant) => (
              <p key={assistant.key} className="graph-activity-who">
                <span className="graph-activity-ring" aria-hidden="true" />
                <span>
                  <b>{assistant.name}</b> {assistant.doing}
                </span>
              </p>
            ))}
            {assistants.length > ASSISTANTS_SHOWN ? (
              <p className="graph-activity-who">
                {t('graph.activity.more', { count: assistants.length - ASSISTANTS_SHOWN })}
              </p>
            ) : null}
          </div>
        ) : null}
        {/*
          There used to be a legend here, a second panel repeating the name of
          every attribute beside its colour. It says nothing the switch above
          does not already say: throwing a switch is what gives the attribute
          its colour, and the switch wears that colour while it is on. The one
          thing the legend held that lives nowhere else is the warning that the
          drawing is not the whole notebook, and that moved down here, next to the
          other thing said about the drawing as a whole.
        */}
        <GraphHelp open={helpOpen} onClose={() => setHelpOpen(false)} nodes={helpNodes} />
        <div className="graph-footer">
          <p>
            {truncated && (
              <>
                {t('graph.truncated')}
                <br />
              </>
            )}
            {held ? (
              <Trans
                i18nKey={
                  held.value
                    ? touchOnly
                      ? 'graph.pinnedTouch'
                      : 'graph.pinned'
                    : touchOnly
                      ? 'graph.focusedTouch'
                      : 'graph.focused'
                }
                values={{ value: held.label }}
                components={{ b: <b /> }}
              />
            ) : (
              t(touchOnly ? 'graph.hintTouch' : 'graph.hint')
            )}
          </p>
          {/* The second step said as a button, so opening a held node does
              not depend on knowing that a second click or tap opens it (#515). */}
          {held?.url ? (
            <Link className="button is-primary is-small graph-footer-open" to={held.url}>
              {t('graph.open')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
