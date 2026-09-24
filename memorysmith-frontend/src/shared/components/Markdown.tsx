import { Attachment } from './Attachment';
import { useNotebookId } from './notebook-id';
import { LinkChoice, linkTargetOf } from './LinkChoice';
import {
  isValidElement,
  useRef,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  remarkBlockIds,
  remarkComments,
  remarkHighlight,
  remarkMathDollarRule,
} from '../api/remark-memorysmith-ring';
import { useTranslation } from 'react-i18next';
import { toUnixNewlines } from '../api/markdown';
import { readDimensions, readImageAlt } from '../api/image-dimensions';
import { followable } from '../api/address';
import { ordinalAt } from '../api/tasklist';
import { remarkCallouts } from '../api/remark-callouts';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { highlightLanguage, highlightTree } from '../api/highlight';
import 'katex/dist/katex.min.css';
import { MermaidDiagram } from './MermaidDiagram';
import { CopyButton } from './CopyButton';

interface MarkdownProps {
  children: string;
  /**
   * The text the ordinal of a task box is counted over. It has to be the text
   * the PARSER saw, because the offsets come from it — not the bytes a write
   * sends back, which are the original ones. Keeping the two aligned is the
   * caller's job, and `WritableContent` does it by refusing to enable the
   * boxes when the two disagree on how many there are.
   */
  source?: string;
  onToggleTask?: (ordinal: number) => void;
  writable?: boolean;
}

type LiProps = HTMLAttributes<HTMLLIElement> & { node?: unknown };

/**
 * What react-markdown hands a component beside the attributes: the hast
 * element it came from. It is not an attribute, and spread onto the element
 * it reached the page as `node="[object Object]"` on every link, image and
 * code span (#190).
 */
type WithNode<T> = T & { node?: unknown };

/**
 * An image, with the dimensions the specification puts in its alt text
 * (RN-DSC-048). What precedes the pipe is the description and is never
 * dropped; what follows it is width, or width and height, in CSS pixels, and
 * never appears as text. A value that is neither stays part of the
 * description, because deleting an accessibility label is the worse failure.
 */
function MarkdownImage({
  alt,
  node: _node,
  ...rest
}: WithNode<ImgHTMLAttributes<HTMLImageElement>>) {
  const read = readImageAlt(alt ?? '');
  return (
    <img
      {...rest}
      alt={read.description}
      {...(read.width === null ? {} : { width: read.width })}
      {...(read.height === null ? {} : { height: read.height })}
    />
  );
}

/**
 * A link to a place in the same note: a footnote and its way back (§7.12),
 * or an anchor an author wrote.
 *
 * It went down the branch of the web, with `target="_blank"`, so following a
 * footnote opened the whole application in another tab (#190). And a bare
 * hash would not have been enough either: the note scrolls inside
 * `.notebook-content`, not in the window, and an embedded note renders the
 * same identifiers a second time. So the target is looked up inside the note
 * the link was drawn in, and brought into view in whatever scrolls it; the
 * address of the page does not change, because nothing was navigated.
 */
function InPageAnchor({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    const id = decodeURIComponent(href.slice(1));
    const note = event.currentTarget.closest('.markdown');
    const target = note?.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'center' });
  };
  return (
    <a href={href} onClick={follow} {...rest}>
      {children}
    </a>
  );
}

function MarkdownAnchor({
  href,
  children,
  node: _node,
  ...rest
}: WithNode<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  // An attachment is a file of the notebook that is not a note, and this product
  // stores none: the reference resolves to nothing, and saying so is what the
  // specification asks for. Drawing it as a link to a note nobody will ever
  // write told the reader the wrong thing about their own notebook (RN-DSC-049).
  /**
   * A file the notebook keeps, drawn by its TYPE (#166, RN-DSC-061): an image,
   * audio and video are drawn, and everything else is a card with a download.
   * A name the notebook keeps nothing under is reported the way a pending link
   * is, which is what `Attachment` does with it.
   */
  if (href?.startsWith('attachment:')) {
    /**
     * The address carries the dimension the pipe declared, after the encoded
     * name, where nothing else can be (§3.14, #173).
     *
     * **Decoded before it is split**, because the parser percent-encodes what
     * it does not have to leave alone: the separator arrives as `%7C` and
     * looking for `|` found nothing, which sent the whole string — dimension
     * included — to be looked up as the name of a file. A name carrying a
     * pipe is no name anyway (§5.3), so the last one is the separator or
     * there is none.
     */
    const address = decodeURIComponent(href.slice('attachment:'.length));
    const at = address.lastIndexOf('|');
    const measured = at === -1 ? null : readDimensions(address.slice(at + 1));
    const name = measured ? address.slice(0, at) : address;
    if (!notebookId) {
      return (
        <span className="attachment-missing" title={t('note.attachmentMissing')}>
          {children}
        </span>
      );
    }
    return (
      <Attachment
        notebookId={notebookId}
        name={name}
        width={measured?.width ?? null}
        height={measured?.height ?? null}
      />
    );
  }
  if (href?.startsWith('pending:')) {
    return (
      <span className="wikilink-pending" title={t('note.pendingLink')}>
        {children}
      </span>
    );
  }
  // Refused by `followable`: the text stays on the page and stops being
  // something to click. An author sees they got nothing, which is the same
  // answer the profile gives for a notation it does not implement.
  if (!href) {
    return (
      <span className="link-refused" title={t('note.refusedLink')}>
        {children}
      </span>
    );
  }
  // A target no single note answers by name opens its choice in place.
  if (linkTargetOf(href)) return <LinkChoice href={href}>{children}</LinkChoice>;
  if (href.startsWith('/')) {
    return (
      <Link className="wikilink" to={href}>
        {children}
      </Link>
    );
  }
  if (href.startsWith('#')) {
    return (
      <InPageAnchor href={href} {...rest}>
        {children}
      </InPageAnchor>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

/**
 * A code span, a fenced block, and the one info string with a rendering rule.
 *
 * The order of the three branches is the contract. `mermaid` is checked first
 * and reaches `MermaidDiagram` with its source untouched, because it is the
 * only info string the profile attaches a rendering rule to (§7.2) and a
 * highlighter in front of that check would swallow a diagram. A language the
 * highlighter carries is tokenised. Everything else — a code span, a fence
 * with no info string, a language nobody registered — renders exactly as it
 * did before highlighting existed, which is the pattern the profile sets for
 * the diagram it cannot draw and the formula it cannot typeset: show the
 * source, never hide it.
 *
 * The tokens arrive as ELEMENTS. `refractor` produces a hast tree and
 * `toJsxRuntime` builds React out of it, so no note-derived markup is ever
 * parsed as HTML — the boundary §7.9 draws, held at the one place a
 * highlighter would otherwise breach it.
 */
function MarkdownCode({
  className,
  children,
  node: _node,
  ...rest
}: WithNode<HTMLAttributes<HTMLElement>>) {
  if (className?.includes('language-mermaid')) {
    return <MermaidDiagram code={String(children).trim()} />;
  }

  const language = highlightLanguage(className);
  if (language !== null) {
    // The source is read and never rewritten: what is on the page is the
    // bytes, split into spans. React-markdown hands the children of a fence as
    // a single string ending in the newline before the closing fence.
    const code = String(children).replace(/\n$/, '');
    return (
      <code className={className} {...rest}>
        {toJsxRuntime(highlightTree(code, language), { Fragment, jsx, jsxs })}
      </code>
    );
  }

  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

/**
 * A fenced block in a frame of its own, with the verb that carries it
 * somewhere else (#194): the look of the connector box of the welcome page,
 * which is where the product already drew code. The frame is not the `pre`:
 * the `pre` scrolls and never wraps, since a wrapped line breaks indentation
 * that carries meaning, and the button has to stay in its corner while the
 * content scrolls under it.
 *
 * What is copied is the `textContent` of the code, which is the bytes as
 * typed because the highlighter's tokens arrive as elements, less the newline
 * before the closing fence.
 *
 * A diagram is not code on the page: its fence is left bare, with no frame and
 * nothing to copy.
 */
function MarkdownPre({ children, node, ...rest }: WithNode<HTMLAttributes<HTMLPreElement>>) {
  const ref = useRef<HTMLPreElement>(null);
  const code = (node as HastElement | undefined)?.children?.find(
    (child) => child.tagName === 'code',
  );
  const classes = code?.properties?.['className'];
  if (Array.isArray(classes) && classes.includes('language-mermaid')) {
    return <pre {...rest}>{children}</pre>;
  }

  return (
    <div className="code-block">
      <pre ref={ref} {...rest}>
        {children}
      </pre>
      <CopyButton
        className="code-copy"
        text={() => (ref.current?.querySelector('code')?.textContent ?? '').replace(/\n$/, '')}
      />
    </div>
  );
}

/** The hast element react-markdown hands a component, as much as is used. */
interface HastElement {
  readonly tagName?: string;
  readonly properties?: Record<string, unknown>;
  readonly children?: readonly HastElement[];
  readonly position?: { readonly start?: { readonly offset?: number } };
}

/**
 * Whether this list item is a task box, and how it is ticked.
 *
 * The state is read from the child `input` that GFM produces, and NOT from a
 * `checked` on the item itself: react-markdown 9 hands a component the **hast**
 * element, which carries no such property. Reading it there returned
 * `undefined` for every item, which sent every task box in the product down
 * the plain branch and onto the screen as GFM's own disabled checkbox — no
 * handler, no click, on any note.
 */
function taskState(node: HastElement | undefined): boolean | null {
  const box = node?.children?.find((child) => child.tagName === 'input');
  const checked = box?.properties?.['checked'];
  return typeof checked === 'boolean' ? checked : null;
}

/**
 * A list item that carries a task box. The ordinal comes from the position the
 * parser reports, mapped back to the n-th task of the source, which is what
 * lets a click become a one-character change in the original text.
 */
function TaskItem({
  node,
  children,
  className,
  source,
  toggleTask,
  writable,
  ...rest
}: LiProps & {
  source: string;
  toggleTask: ((ordinal: number) => void) | undefined;
  writable: boolean;
}) {
  const element = node as HastElement | undefined;
  const checked = taskState(element);
  if (checked === null) {
    return (
      <li className={className} {...rest}>
        {children}
      </li>
    );
  }

  const offset = element?.position?.start?.offset;
  const ordinal = offset === undefined ? -1 : ordinalAt(source, offset);
  const enabled = writable && toggleTask !== undefined && ordinal >= 0;

  return (
    // Our class comes LAST, because the one react-markdown passes in is on
    // `className` and spreading it after would silently take the item back.
    <li {...rest} className={`${className ?? ''} task-item`.trim()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!enabled}
        onChange={() => enabled && toggleTask(ordinal)}
      />
      {/* The box GFM already rendered is dropped: it is `disabled`, it answers
          to nothing, and two boxes in one item is worse than none. */}
      {dropBox(children)}
    </li>
  );
}

/**
 * The children of the item without the checkbox GFM put in front of them.
 *
 * It is matched by element type rather than by position, because a leading
 * space follows it and neither the space nor the order is part of any contract.
 */
function dropBox(children: ReactNode): ReactNode {
  if (!Array.isArray(children)) return children;
  return (children as ReactNode[]).filter(
    (child) => !(isValidElement(child) && child.type === 'input'),
  );
}
export function Markdown({ children, source, onToggleTask, writable = false }: MarkdownProps) {
  const text = toUnixNewlines(children);
  const { t, i18n } = useTranslation();
  const calloutTitle = (kind: string): string | undefined =>
    i18n.exists(`callout.${kind}`) ? t(`callout.${kind}`) : undefined;

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[
          /**
           * `singleTilde: false` is a decision and not a default.
           *
           * GFM specifies strikethrough as `~~x~~`; GitHub also accepts a
           * single tilde, outside its own specification. Here that extension
           * actively misrenders the one notation the profile declares absent:
           * somebody writing `H~2~O` for a subscript would get `H` struck-out
           * `2` `O`, which is a worse answer than nothing. With it off the
           * characters stay on the page, and the author can see they got what
           * the profile says they get, which is nothing (profile 5.9).
           */
          [remarkGfm, { singleTilde: false }],
          [remarkCallouts, { titleOf: calloutTitle }],
          remarkHighlight,
          remarkComments,
          remarkBlockIds,
          remarkMath,
          // After remark-math, and it gives back what was never a formula.
          remarkMathDollarRule,
        ]}
        // Raw HTML is NOT enabled, and its absence is the point: no
        // `rehype-raw` is loaded, so a note carrying `<script>` is text. It is
        // a security boundary rather than a rendering preference, because a
        // notebook is written by several people and by agents (profile 5.10).
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        // Footnotes (§7.12): the words around them are the reader's, and the
        // label heads the notes gathered at the end of the note, where a
        // reader sees it — GFM hides it, and nothing in this stylesheet was
        // hiding anything, so it was a visible heading in English (#190).
        remarkRehypeOptions={{
          footnoteLabel: t('note.footnotes'),
          footnoteLabelProperties: { className: ['footnotes-label'] },
          footnoteBackLabel: (referenceIndex: number) =>
            t('note.footnoteBack', { number: referenceIndex + 1 }),
        }}
        // Which addresses this surface will follow, and the reason the stock
        // filter is not doing it, are in `address.ts` (RN-DSC-039).
        urlTransform={followable}
        components={{
          a: MarkdownAnchor,
          code: MarkdownCode,
          pre: MarkdownPre,
          img: MarkdownImage,
          li: (props: LiProps) => (
            <TaskItem
              {...props}
              source={source ?? text}
              toggleTask={onToggleTask}
              writable={writable}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
