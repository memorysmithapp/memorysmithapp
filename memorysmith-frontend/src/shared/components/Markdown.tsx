import type { AnchorHTMLAttributes, HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { toUnixNewlines } from '../api/markdown';
import { ordinalAt } from '../api/tasklist';
import { remarkCallouts } from '../api/remark-callouts';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownProps {
  children: string;
  /**
   * The original text a click writes back to. It is not always what is
   * rendered: wikilinks are resolved before rendering, and the toggle has to
   * land on the bytes the author wrote.
   */
  source?: string;
  onToggleTask?: (ordinal: number) => void;
  writable?: boolean;
}

type LiProps = HTMLAttributes<HTMLLIElement> & { node?: unknown };

function MarkdownAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { t } = useTranslation();
  if (href?.startsWith('pending:')) {
    return (
      <span className="wikilink-pending" title={t('note.pendingLink')}>
        {children}
      </span>
    );
  }
  if (href?.startsWith('/')) {
    return (
      <Link className="wikilink" to={href}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

function MarkdownCode({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  if (className?.includes('language-mermaid')) {
    return <MermaidDiagram code={String(children).trim()} />;
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

/**
 * A list item that carries a task box. The ordinal comes from the position the
 * parser reports, mapped back to the n-th task of the source, which is what
 * lets a click become a one-character change in the original text.
 */
function TaskItem({
  node,
  children,
  source,
  toggleTask,
  writable,
  ...rest
}: LiProps & {
  source: string;
  toggleTask: ((ordinal: number) => void) | undefined;
  writable: boolean;
}) {
  const checked = (node as { checked?: boolean | null } | undefined)?.checked;
  if (checked === null || checked === undefined) {
    return <li {...rest}>{children}</li>;
  }

  const offset = (node as { position?: { start?: { offset?: number } } })?.position?.start?.offset;
  const ordinal = offset === undefined ? -1 : ordinalAt(source, offset);
  const enabled = writable && toggleTask !== undefined && ordinal >= 0;

  return (
    <li className="task-item" {...rest}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!enabled}
        onChange={() => enabled && toggleTask(ordinal)}
      />
      {children}
    </li>
  );
}
export function Markdown({ children, source, onToggleTask, writable = false }: MarkdownProps) {
  const text = toUnixNewlines(children);

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        urlTransform={(url) => url}
        components={{
          a: MarkdownAnchor,
          code: MarkdownCode,
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
