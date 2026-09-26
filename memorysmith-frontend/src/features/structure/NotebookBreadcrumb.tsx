import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { fitTrail, type TrailFit } from './trail-fit';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FolderNode } from '../../shared/types/api';
import { folderAddress, notebookAddress } from '../../shared/api/note-address';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

export interface Crumb {
  label: string;
  /** Where the crumb leads. A crumb without one is the page that is open. */
  to?: string;
}

interface NotebookBreadcrumbProps {
  // Trail after the notebook root.
  items: Crumb[];
}

/** The least the name of the notebook keeps: the trail starts there. */
const NOTEBOOK_MIN_PX = 72;
/** The gap of the trail, on each side of a separator. */
const GAP_PX = 6;
/** Room kept against the rounding of one engine or another. */
const SLACK_PX = 2;

// Every page inside a notebook starts its trail at the notebook name, which
// links to the Notebook Context. The trail ends at the page that is open and no
// heading repeats it (#225); the note is the exception, whose trail stops at
// the folder that holds it, because its name is the title of the page. The
// trail of folders is read here, from the structure already loaded, and never
// from the address, which carries identifiers alone (RN-DSC-045).
//
// When it does not fit it gives up space in the order `fitTrail` decides
// (#235): the notebook shortens to a minimum, then the middle collapses into
// one `…`, then the last crumb shortens. The widths are measured on a copy of
// the trail that never shrinks, and applied as they were decided: nothing is
// left to how an engine shares flex shrinking, which is what put the last
// crumb first on an iPhone.
export function NotebookBreadcrumb({ items }: NotebookBreadcrumbProps) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const trail: Crumb[] = [
    { label: structure.notebook.name, to: notebookAddress(notebookId) },
    ...items,
  ];
  const middle = trail.length > 2 ? trail.slice(1, -1) : [];
  const lastCrumb = trail.length > 1 ? trail[trail.length - 1]! : null;
  const nav = useRef<HTMLElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<TrailFit | null>(null);
  // A render is all the observer and the fonts ask for: the fit is measured
  // again after every one.
  const [, setTick] = useState(0);

  // The width of the bar, and the webfont arriving after the first paint,
  // both change what fits.
  useEffect(() => {
    const node = nav.current;
    const measured = ruler.current;
    const again = () => setTick((value) => value + 1);
    if (!node) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(again);
    observer?.observe(node);
    if (measured) observer?.observe(measured);
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    fonts?.addEventListener?.('loadingdone', again);
    void fonts?.ready?.then(again);
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener?.('loadingdone', again);
    };
  }, []);

  useLayoutEffect(() => {
    const node = nav.current;
    const measured = ruler.current;
    if (!node || !measured) return;
    const width = (part: string) =>
      [...measured.querySelectorAll<HTMLElement>(`[data-part="${part}"]`)].map(
        (element) => element.getBoundingClientRect().width,
      );
    const [notebook = 0] = width('notebook');
    const [separator = 0] = width('separator');
    const [more = 0] = width('more');
    const [last = null] = width('last');
    const next = fitTrail({
      notebook,
      middle: width('middle'),
      last,
      separator,
      gap: GAP_PX,
      more,
      available: node.clientWidth - SLACK_PX,
      notebookMin: NOTEBOOK_MIN_PX,
    });
    setFit((current) =>
      current &&
      current.hidden === next.hidden &&
      current.notebook === next.notebook &&
      current.last === next.last
        ? current
        : next,
    );
    // On every render and not only when the observer calls: the actions of a
    // note arrive in a render of the bar, and in a tab that is not visible
    // the observer waits until the tab is shown again. The state only changes
    // when the fit does, so this settles in one pass.
  });

  const hidden = fit?.hidden ?? 0;
  // The `…` leads where the collapsed crumbs end: the deepest of them, the one
  // right above what is still shown.
  const collapsed = middle.slice(0, hidden);
  const target = collapsed[collapsed.length - 1];
  const shown: (Crumb | 'more')[] = [
    trail[0]!,
    ...(hidden > 0 ? ['more' as const] : []),
    ...middle.slice(hidden),
    ...(lastCrumb ? [lastCrumb] : []),
  ];
  const last = shown.length - 1;
  const separator = (
    <span className="crumb-separator" aria-hidden="true">
      /
    </span>
  );

  return (
    <nav ref={nav} className="notebook-breadcrumb" aria-label={t('structure.breadcrumb')}>
      {shown.map((crumb, index) => {
        if (crumb === 'more') {
          return (
            <Fragment key="more">
              {separator}
              <Link
                to={target?.to ?? notebookAddress(notebookId)}
                className="crumb crumb-more"
                title={collapsed.map((each) => each.label).join(' / ')}
                aria-label={target?.label}
              >
                …
              </Link>
            </Fragment>
          );
        }
        const isNotebook = index === 0;
        const isLast = index === last && !isNotebook;
        const className = `crumb${isNotebook ? ' is-notebook' : ''}${index === last ? ' is-last' : ''}`;
        const style =
          fit && isNotebook
            ? { width: fit.notebook }
            : fit && isLast && fit.last !== null
              ? { maxWidth: fit.last }
              : undefined;
        return (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 ? separator : null}
            {crumb.to ? (
              <Link to={crumb.to} className={className} title={crumb.label} style={style}>
                {crumb.label}
              </Link>
            ) : (
              <span className={className} aria-current="page" title={crumb.label} style={style}>
                {crumb.label}
              </span>
            )}
          </Fragment>
        );
      })}
      {/* The trail as it would be drawn whole, where nobody sees it: what each
          part measures is read here, never off parts already shortened. */}
      <div ref={ruler} className="notebook-breadcrumb-ruler" aria-hidden="true">
        <span data-part="notebook">{trail[0]!.label}</span>
        <span data-part="separator">/</span>
        <span data-part="more">…</span>
        {middle.map((crumb, index) => (
          <span key={`${index}-${crumb.label}`} data-part="middle">
            {crumb.label}
          </span>
        ))}
        {lastCrumb ? <span data-part="last">{lastCrumb.label}</span> : null}
      </div>
    </nav>
  );
}

export function folderCrumbs(notebookId: string, chain: FolderNode[]): Crumb[] {
  return chain.map((folder) => ({
    label: folder.name,
    to: folderAddress(notebookId, folder.id),
  }));
}

/**
 * The Guidance, the Templates and the page of the folders are parts of the
 * Context, and their trail says so: *Caderno / Contexto do caderno / Orientação*.
 */
export function contextCrumbs(notebookId: string, t: TFunction, page: string): Crumb[] {
  return [{ label: t('structure.heading'), to: notebookAddress(notebookId) }, { label: page }];
}

/**
 * The bar every screen of a notebook opens with (#225): fixed above the
 * content, the trail on the left, and on the right the actions of the page,
 * which only the note has. It is rendered by each page, before its article and
 * never inside it: `.content-pane` restyles every heading under it, and the
 * state the actions act on (editing, copied) belongs to the page.
 */
export function NotebookBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="notebook-bar">
      <NotebookBreadcrumb items={crumbs} />
      {children ? <div className="notebook-bar-actions">{children}</div> : null}
    </div>
  );
}

/**
 * A button of the bar: its icon and its label on a computer, the icon alone on
 * a phone — where the label stays as the accessible name, hidden by CSS and
 * never removed.
 */
export function BarButton({
  icon,
  label,
  title,
  onClick,
  ref,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" className="bar-button" onClick={onClick} title={title ?? label}>
      {icon}
      <span className="bar-button-label">{label}</span>
    </button>
  );
}
