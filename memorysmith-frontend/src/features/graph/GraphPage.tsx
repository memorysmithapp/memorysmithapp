import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  forceCenter,
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
import { VaultBreadcrumb } from '../structure/VaultBreadcrumb';
import { resolveNoteUrl } from '../../shared/api/source';
import { getVaultGraph } from '../../shared/api/backend';

interface GraphFile {
  nodes: { id: string; title: string; facets: Record<string, string[]> }[];
  edges: [number, number][];
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  kind: 'note' | 'value';
  /** What this note says about itself; empty on a value node. */
  facets: Record<string, string[]>;
  degree: number;
  radius: number;
}

type GraphLink = SimulationLinkDatum<GraphNode>;

/**
 * How many distinct values an attribute may have and still be offered as a
 * color: above this it is a label, not a category, and coloring by it would
 * paint every node the same shade of "other".
 */
const MAX_COLORABLE_VALUES = 24;
/** Only three categorical slots exist in the brand palette; the rest is Other. */
const COLOR_SLOTS = 3;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** An attribute of the vault, as the graph sees it: its values, by frequency. */
interface Attribute {
  readonly name: string;
  /** Distinct values, most frequent first: the order the palette follows. */
  readonly values: string[];
  /** How many notes declare it, which is what says whether "not declared" exists. */
  readonly declaredBy: number;
  readonly multivalued: boolean;
  readonly boolean: boolean;
}

function attributesOf(nodes: GraphFile['nodes']): Attribute[] {
  const counts = new Map<string, Map<string, number>>();
  const declaredBy = new Map<string, number>();
  const multivalued = new Set<string>();

  for (const node of nodes) {
    for (const [facet, values] of Object.entries(node.facets)) {
      if (values.length === 0) continue;
      if (values.length > 1) multivalued.add(facet);
      declaredBy.set(facet, (declaredBy.get(facet) ?? 0) + 1);
      const byValue = counts.get(facet) ?? new Map<string, number>();
      for (const value of values) byValue.set(value, (byValue.get(value) ?? 0) + 1);
      counts.set(facet, byValue);
    }
  }

  return [...counts.entries()]
    .map(([name, byValue]) => {
      const values = [...byValue.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([value]) => value);
      return {
        name,
        values,
        declaredBy: declaredBy.get(name) ?? 0,
        multivalued: multivalued.has(name),
        boolean:
          values.length <= 2 && values.every((value) => value === 'true' || value === 'false'),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
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
  const { vaultSlug = '' } = useParams();
  const theme = usePreferences((s) => s.theme);
  const [truncated, setTruncated] = useState(false);
  const [colorBy, setColorBy] = useState('none');
  const [valuesOf, setValuesOf] = useState('none');
  const [data, setData] = useState<GraphFile | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    nodes: GraphNode[];
    links: GraphLink[];
    neighbors: Map<GraphNode, Set<GraphNode>>;
    sim: Simulation<GraphNode, GraphLink> | null;
    transform: { x: number; y: number; k: number };
    hovered: GraphNode | null;
    colorBy: string;
    palette: string[];
    isBoolean: boolean;
    redraw: (() => void) | null;
  }>({
    nodes: [],
    links: [],
    neighbors: new Map(),
    sim: null,
    transform: { x: 0, y: 0, k: 1 },
    hovered: null,
    colorBy: 'none',
    palette: [],
    isBoolean: false,
    redraw: null,
  });

  /**
   * The graph is the link projection of Discovery, and each node carries the
   * portrait the facet projection keeps of that note. The backend still does
   * not interpret content (PP4): those attributes were classified by the shape
   * of the value, so the controls below offer whatever THIS vault declares,
   * and a vault that declares nothing simply shows no control.
   */
  useEffect(() => {
    let live = true;
    void getVaultGraph(vaultSlug)
      .then((graph) => {
        if (!live) return;
        setData({
          nodes: graph.nodes.map((note) => ({
            id: note.slug,
            title: note.title,
            facets: note.facets ?? {},
          })),
          edges: graph.edges,
        });
        setTruncated(graph.truncated);
      })
      .catch(() => {
        if (live) setData({ nodes: [], edges: [] });
      });
    return () => {
      live = false;
    };
  }, [vaultSlug]);

  const noteCount = data?.nodes.length ?? 0;
  const attributes = useMemo(() => (data ? attributesOf(data.nodes) : []), [data]);
  const colorable = useMemo(
    () => attributes.filter((each) => each.values.length <= MAX_COLORABLE_VALUES),
    [attributes],
  );
  /** An attribute worth drawing as nodes is one a note carries several of. */
  const drawable = useMemo(() => attributes.filter((each) => each.multivalued), [attributes]);

  // An attribute that stops existing (another vault, a rebuilt projection)
  // must not leave a control pointing at nothing.
  useEffect(() => {
    if (colorBy !== 'none' && !colorable.some((each) => each.name === colorBy)) setColorBy('none');
    if (valuesOf !== 'none' && !drawable.some((each) => each.name === valuesOf))
      setValuesOf('none');
  }, [colorable, drawable, colorBy, valuesOf]);

  const active = colorable.find((each) => each.name === colorBy) ?? null;
  const legend = useMemo(() => (active ? active.values.slice(0, COLOR_SLOTS) : []), [active]);

  useEffect(() => {
    const state = stateRef.current;
    state.colorBy = colorBy;
    state.palette = legend;
    state.isBoolean = active?.boolean ?? false;
    state.redraw?.();
  }, [colorBy, legend, active]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const nodes: GraphNode[] = data.nodes.map((n) => ({
      id: n.id,
      title: n.title,
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

    // The values of one attribute, drawn as nodes: this is what makes a tag
    // visible as the thing several notes have in common, rather than a word
    // repeated in their frontmatter.
    if (valuesOf !== 'none') {
      const indexOfValue = new Map<string, number>();
      data.nodes.forEach((note, noteIndex) => {
        for (const value of note.facets[valuesOf] ?? []) {
          let at = indexOfValue.get(value);
          if (at === undefined) {
            at = nodes.length;
            indexOfValue.set(value, at);
            nodes.push({
              id: `${valuesOf}:${value}`,
              title: value,
              kind: 'value',
              facets: {},
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

    for (const node of nodes) {
      node.radius = node.kind === 'value' ? 2.5 : Math.min(13, 2.2 + 1.25 * Math.sqrt(node.degree));
    }
    return { nodes, links };
  }, [data, valuesOf]);

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

    const nodes = filtered.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = filtered.links.map((l) => ({ ...l }));
    state.nodes = nodes;
    state.links = links;
    state.transform = {
      x: width / 2,
      y: height / 2,
      k: Math.min(1, 600 / Math.sqrt(nodes.length) / 12),
    };
    state.hovered = null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx) return;
      const { x, y, k } = state.transform;
      const colors = {
        note: cssVar('--accent') || '#0f56d7',
        value: cssVar('--signal') || '#ff8a2b',
        edge: cssVar('--text-soft') || '#6f6d64',
        label: cssVar('--text') || '#26251f',
        halo: cssVar('--bg') || '#fafaf8',
        other: cssVar('--cat-other') || '#8b96a8',
      };
      const categorical = [
        cssVar('--cat-1') || '#ff8a2b',
        cssVar('--cat-2') || '#0f56d7',
        cssVar('--cat-3') || '#16a34a',
      ];
      const truthy = cssVar('--seq-evergreen') || '#0f56d7';
      const falsy = cssVar('--seq-seed') || '#bfd2f6';

      function nodeFill(node: GraphNode): string {
        const mode = state.colorBy;
        if (node.kind === 'value') return mode === 'none' ? colors.value : colors.other;
        if (mode === 'none') return colors.note;
        const [value] = node.facets[mode] ?? [];
        if (value === undefined) return colors.other;
        if (state.isBoolean) return value === 'true' ? truthy : falsy;
        const slot = state.palette.indexOf(value);
        return slot >= 0 ? (categorical[slot] ?? colors.other) : colors.other;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(x, y);
      ctx.scale(k, k);

      const hovered = state.hovered;
      const neighborSet = hovered ? state.neighbors.get(hovered) : null;

      ctx.globalAlpha = hovered ? 0.06 : 0.14;
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      for (const link of state.links) {
        const s = link.source as GraphNode;
        const tN = link.target as GraphNode;
        if (hovered && s !== hovered && tN !== hovered) continue;
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(tN.x ?? 0, tN.y ?? 0);
      }
      ctx.stroke();

      if (hovered) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        for (const link of state.links) {
          const s = link.source as GraphNode;
          const tN = link.target as GraphNode;
          if (s !== hovered && tN !== hovered) continue;
          ctx.moveTo(s.x ?? 0, s.y ?? 0);
          ctx.lineTo(tN.x ?? 0, tN.y ?? 0);
        }
        ctx.stroke();
      }

      for (const node of state.nodes) {
        const dimmed = hovered && node !== hovered && !neighborSet?.has(node);
        ctx.globalAlpha = dimmed ? 0.15 : 1;
        ctx.fillStyle = nodeFill(node);
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const labelTargets = hovered
        ? [hovered, ...(neighborSet ? [...neighborSet].slice(0, 18) : [])]
        : state.nodes.filter((n) => n.kind === 'note' && n.degree >= 25).slice(0, 12);
      ctx.globalAlpha = 1;
      ctx.font = `${Math.max(10 / k, 4)}px Inter, sans-serif`;
      ctx.textBaseline = 'middle';
      for (const node of labelTargets) {
        const label = node.title;
        const lx = (node.x ?? 0) + node.radius + 3 / k;
        const ly = node.y ?? 0;
        ctx.lineWidth = 3 / k;
        ctx.strokeStyle = colors.halo;
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = colors.label;
        ctx.fillText(label, lx, ly);
      }
    }

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).distance(28).strength(0.4))
      .force('charge', forceManyBody().strength(-24))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .on('tick', draw);
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

    function toGraphSpace(event: { clientX: number; clientY: number }) {
      const rect = canvas!.getBoundingClientRect();
      const { x, y, k } = state.transform;
      return { gx: (event.clientX - rect.left - x) / k, gy: (event.clientY - rect.top - y) / k };
    }

    function hitTest(gx: number, gy: number): GraphNode | null {
      let best: GraphNode | null = null;
      let bestDist = Infinity;
      for (const node of state.nodes) {
        const dx = (node.x ?? 0) - gx;
        const dy = (node.y ?? 0) - gy;
        const dist = dx * dx + dy * dy;
        const hit = Math.max(node.radius + 4 / state.transform.k, 6 / state.transform.k);
        if (dist < hit * hit && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
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
      if (hit !== state.hovered) {
        state.hovered = hit;
        canvas!.style.cursor = hit ? 'pointer' : 'grab';
        draw();
      }
    }
    function onUp(event: MouseEvent) {
      dragging = false;
      if (moved) return;
      const { gx, gy } = toGraphSpace(event);
      const hit = hitTest(gx, gy);
      // A value node addresses no document: it is a grouping, not a note.
      if (hit && hit.kind === 'note') {
        const url = resolveNoteUrl(vaultSlug, hit.id);
        if (url) void navigate(url);
      }
    }
    function onLeave() {
      dragging = false;
      if (state.hovered) {
        state.hovered = null;
        draw();
      }
    }

    /**
     * Touch. One finger drags the graph, two pinch it, and a finger that lands
     * and lifts without travelling is a tap that opens the note under it. There
     * is no hover to keep: a finger is either touching or it is not.
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
      const { gx, gy } = toGraphSpace(touch);
      const hit = hitTest(gx, gy);
      if (hit && hit.kind === 'note') {
        const url = resolveNoteUrl(vaultSlug, hit.id);
        if (url) void navigate(url);
      }
    }

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
  }, [filtered, navigate, vaultSlug, theme]);

  return (
    <div className="graph-page">
      <div className="graph-toolbar">
        <div className="graph-title">
          <VaultBreadcrumb items={[{ label: t('graph.heading') }]} className="graph-breadcrumb" />
          <h1>{t('graph.heading')}</h1>
        </div>
        {/*
          Both controls are built from what this vault declares. A vault whose
          notes carry no frontmatter offers neither, because a control that
          steers nothing is worse than no control.
        */}
        {colorable.length > 0 && (
          <label className="graph-toggle graph-colorby">
            {t('graph.colorBy')}
            <select value={colorBy} onChange={(e) => setColorBy(e.target.value)}>
              <option value="none">{t('graph.colorNone')}</option>
              {colorable.map((attribute) => (
                <option key={attribute.name} value={attribute.name}>
                  {attribute.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {drawable.length > 0 && (
          <label className="graph-toggle graph-colorby">
            {t('graph.attributeNodes')}
            <select value={valuesOf} onChange={(e) => setValuesOf(e.target.value)}>
              <option value="none">{t('graph.attributeNone')}</option>
              {drawable.map((attribute) => (
                <option key={attribute.name} value={attribute.name}>
                  {attribute.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="graph-legend">
          {!active && (
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--accent)' }} />
              {t('graph.legendNotes')}
            </span>
          )}
          {active?.boolean &&
            active.values.map((value: string) => (
              <span key={value} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{
                    background: value === 'true' ? 'var(--seq-evergreen)' : 'var(--seq-seed)',
                  }}
                />
                {value}
              </span>
            ))}
          {active &&
            !active.boolean &&
            legend.map((value, index) => (
              <span key={value} className="legend-item">
                <span className="legend-swatch" style={{ background: `var(--cat-${index + 1})` }} />
                {value}
              </span>
            ))}
          {active && (active.values.length > legend.length || active.declaredBy < noteCount) && (
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: 'var(--cat-other)' }} />
              {active.values.length > legend.length
                ? t('graph.legendOther')
                : t('graph.legendUnset')}
            </span>
          )}
          {valuesOf !== 'none' && (
            <span className="legend-item">
              <span
                className="legend-swatch"
                style={{ background: active ? 'var(--cat-other)' : 'var(--signal)' }}
              />
              {t('graph.legendTags')}
            </span>
          )}
          {truncated && <span className="legend-item">{t('graph.truncated')}</span>}
        </span>
      </div>
      <div className="graph-canvas-wrap">
        {!filtered && <p className="status">{t('common.loading')}</p>}
        {filtered?.nodes.length === 0 && <p className="status">{t('graph.empty')}</p>}
        <canvas ref={canvasRef} />
        <span className="graph-hint">{t(touchOnly ? 'graph.hintTouch' : 'graph.hint')}</span>
      </div>
    </div>
  );
}
