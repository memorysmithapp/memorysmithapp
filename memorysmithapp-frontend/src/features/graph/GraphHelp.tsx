import { useTranslation } from 'react-i18next';
import { Modal } from '../../shared/components/Modal';

/**
 * What the notebook graph draws, said in a modal behind the `?` under its gear
 * (#507): every animation of the agents beside a small drawing that plays it,
 * and every kind of node in the colour it wears in this notebook.
 *
 * The drawings are SVG and CSS, not the canvas, so they loop on their own and
 * stand still under reduced motion; their marks are the canvas's, outlines and
 * strokes in the orange of the activity, never filled.
 */

/** A node of the help: a kind or a property, in the colour it wears here. */
export interface HelpNode {
  readonly key: string;
  readonly label: string;
  /** A CSS colour; null for a property not switched on, drawn as an empty ring. */
  readonly color: string | null;
  readonly meaning: string;
}

const ANIMATIONS = ['read', 'write', 'sequence', 'wave'] as const;

/** A node disc of a sample, in the note blue. */
function Disc({ x, y, r = 4 }: { x: number; y: number; r?: number }) {
  return <circle className="graph-help-disc" cx={x} cy={y} r={r} />;
}

/** The ring a read opens from a node, as the canvas draws it. */
function Ring({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <circle
      className="graph-help-ring"
      cx={x}
      cy={y}
      r={7}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function Sample({ kind }: { kind: (typeof ANIMATIONS)[number] }) {
  if (kind === 'read') {
    return (
      <svg className="graph-help-sample" viewBox="0 0 72 44" aria-hidden="true">
        <line className="graph-help-edge" x1={36} y1={22} x2={12} y2={10} />
        <line className="graph-help-edge" x1={36} y1={22} x2={60} y2={32} />
        <Disc x={12} y={10} r={3} />
        <Disc x={60} y={32} r={3} />
        <Disc x={36} y={22} r={5} />
        <Ring x={36} y={22} />
      </svg>
    );
  }
  if (kind === 'write') {
    const ends = [
      [12, 10],
      [62, 14],
      [56, 38],
    ] as const;
    return (
      <svg className="graph-help-sample" viewBox="0 0 72 44" aria-hidden="true">
        {ends.map(([x, y]) => (
          <line key={`e${x}`} className="graph-help-edge" x1={36} y1={24} x2={x} y2={y} />
        ))}
        {ends.map(([x, y]) => (
          <Disc key={`d${x}`} x={x} y={y} r={3} />
        ))}
        {ends.map(([x, y]) => (
          <line
            key={`s${x}`}
            className="graph-help-stroke"
            pathLength={1}
            x1={36}
            y1={24}
            x2={x}
            y2={y}
          />
        ))}
        <Disc x={36} y={24} r={5} />
        <circle className="graph-help-pulse" cx={36} cy={24} r={8} />
        <circle className="graph-help-pulse is-outer" cx={36} cy={24} r={11.5} />
      </svg>
    );
  }
  if (kind === 'sequence') {
    const row = [10, 27, 44, 61];
    return (
      <svg className="graph-help-sample" viewBox="0 0 72 44" aria-hidden="true">
        <line className="graph-help-edge" x1={10} y1={22} x2={61} y2={22} />
        {row.map((x) => (
          <Disc key={x} x={x} y={22} r={4} />
        ))}
        {row.map((x, index) => (
          <Ring key={`r${x}`} x={x} y={22} delay={index * 0.3} />
        ))}
      </svg>
    );
  }
  // The wave: from the centre out, each node later the farther it is.
  const grid = [
    [36, 22],
    [22, 12],
    [50, 12],
    [22, 32],
    [50, 32],
    [8, 22],
    [64, 22],
  ] as const;
  return (
    <svg className="graph-help-sample" viewBox="0 0 72 44" aria-hidden="true">
      {grid.map(([x, y]) => (
        <Disc key={`${x}-${y}`} x={x} y={y} r={3} />
      ))}
      {grid.map(([x, y]) => (
        <Ring key={`r${x}-${y}`} x={x} y={y} delay={(Math.hypot(x - 36, y - 22) / 28) * 0.8} />
      ))}
    </svg>
  );
}

export function GraphHelp({
  open,
  onClose,
  nodes,
}: {
  open: boolean;
  onClose: () => void;
  nodes: readonly HelpNode[];
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={t('graph.help.title')}
      onClose={onClose}
      className="graph-help-dialog"
    >
      <section className="graph-help-section">
        <h3>{t('graph.help.agents')}</h3>
        <ul className="graph-help-list">
          {ANIMATIONS.map((kind) => (
            <li key={kind} className="graph-help-row">
              <Sample kind={kind} />
              <div>
                <b>{t(`graph.help.${kind}.name`)}</b>
                <p>{t(`graph.help.${kind}.meaning`)}</p>
              </div>
            </li>
          ))}
          <li className="graph-help-row">
            <span className="graph-help-notice" aria-hidden="true">
              <span className="graph-activity-ring" />
            </span>
            <div>
              <b>{t('graph.help.notice.name')}</b>
              <p>{t('graph.help.notice.meaning')}</p>
            </div>
          </li>
        </ul>
      </section>
      <section className="graph-help-section">
        <h3>{t('graph.help.nodes')}</h3>
        <ul className="graph-help-list">
          {nodes.map((node) => (
            <li key={node.key} className="graph-help-row is-node">
              <span
                className={`graph-help-dot${node.color ? '' : ' is-off'}`}
                style={node.color ? { background: node.color } : undefined}
                aria-hidden="true"
              />
              <div>
                <b>{node.label}</b>
                <p>{node.meaning}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="graph-help-foot">{t('graph.help.edges')}</p>
      </section>
    </Modal>
  );
}
