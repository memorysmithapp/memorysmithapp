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

interface GraphFile {
  nodes: { id: string; title: string; kind: 'note' | 'tag' }[];
  edges: [number, number][];
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  kind: 'note' | 'tag';
  degree: number;
  radius: number;
}

type GraphLink = SimulationLinkDatum<GraphNode>;

const graphFiles = import.meta.glob('/seed/graph/*.json') as Record<string, () => Promise<{ default: GraphFile }>>;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function GraphPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { vaultSlug = '' } = useParams();
  const theme = usePreferences((s) => s.theme);
  const [showTags, setShowTags] = useState(true);
  const [data, setData] = useState<GraphFile | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    nodes: GraphNode[];
    links: GraphLink[];
    neighbors: Map<GraphNode, Set<GraphNode>>;
    sim: Simulation<GraphNode, GraphLink> | null;
    transform: { x: number; y: number; k: number };
    hovered: GraphNode | null;
  }>({ nodes: [], links: [], neighbors: new Map(), sim: null, transform: { x: 0, y: 0, k: 1 }, hovered: null });

  useEffect(() => {
    const loader = graphFiles[`/seed/graph/${vaultSlug}.json`];
    if (!loader) return;
    void loader().then((mod) => setData(mod.default));
  }, [vaultSlug]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const keep = data.nodes.map((n) => showTags || n.kind === 'note');
    const indexMap = new Map<number, number>();
    const nodes: GraphNode[] = [];
    data.nodes.forEach((n, i) => {
      if (!keep[i]) return;
      indexMap.set(i, nodes.length);
      nodes.push({ id: n.id, title: n.title, kind: n.kind, degree: 0, radius: 3 });
    });
    const links: { source: number; target: number }[] = [];
    for (const [s, tIdx] of data.edges) {
      const si = indexMap.get(s);
      const ti = indexMap.get(tIdx);
      if (si === undefined || ti === undefined) continue;
      links.push({ source: si, target: ti });
      const sn = nodes[si];
      const tn = nodes[ti];
      if (sn) sn.degree += 1;
      if (tn) tn.degree += 1;
    }
    for (const node of nodes) {
      node.radius = node.kind === 'tag' ? 2.5 : Math.min(9, 2.5 + Math.sqrt(node.degree));
    }
    return { nodes, links };
  }, [data, showTags]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filtered) return;
    const state = stateRef.current;
    state.sim?.stop();

    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 900;
    const height = parent?.clientHeight ?? 640;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const nodes = filtered.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = filtered.links.map((l) => ({ ...l }));
    state.nodes = nodes;
    state.links = links;
    state.transform = { x: width / 2, y: height / 2, k: Math.min(1, 600 / Math.sqrt(nodes.length) / 12) };
    state.hovered = null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!ctx) return;
      const { x, y, k } = state.transform;
      const colors = {
        note: cssVar('--accent') || '#0f56d7',
        tag: cssVar('--signal') || '#ff8a2b',
        edge: cssVar('--text-soft') || '#6f6d64',
        label: cssVar('--text') || '#26251f',
        halo: cssVar('--bg') || '#fafaf8',
      };
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
        ctx.fillStyle = node.kind === 'tag' ? colors.tag : colors.note;
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

    function toGraphSpace(event: MouseEvent) {
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

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const tr = state.transform;
      const nk = Math.min(6, Math.max(0.08, tr.k * factor));
      tr.x = mx - ((mx - tr.x) / tr.k) * nk;
      tr.y = my - ((my - tr.y) / tr.k) * nk;
      tr.k = nk;
      draw();
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
      if (hit && hit.kind === 'note') void navigate(`/vaults/${vaultSlug}/notes/${hit.id}`);
    }
    function onLeave() {
      dragging = false;
      if (state.hovered) {
        state.hovered = null;
        draw();
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      sim.stop();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onLeave);
    };
    // The theme dependency re-runs the effect so the canvas repaints with the
    // active token values.
  }, [filtered, navigate, vaultSlug, theme]);

  return (
    <div className="graph-page">
      <div className="graph-toolbar">
        <h1>{t('graph.heading')}</h1>
        <label className="graph-toggle">
          <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />
          {t('graph.showTags')}
        </label>
        <span className="graph-legend">
          <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--accent)' }} />{t('graph.legendNotes')}</span>
          <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--signal)' }} />{t('graph.legendTags')}</span>
        </span>
        <span className="graph-hint">{t('graph.hint')}</span>
      </div>
      <div className="graph-canvas-wrap">
        {!filtered && <p className="status">{t('common.loading')}</p>}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
