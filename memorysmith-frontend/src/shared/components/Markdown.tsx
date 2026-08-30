import type { AnchorHTMLAttributes, HTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { toUnixNewlines } from '../api/markdown';
import { remarkCallouts } from '../api/remark-callouts';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownProps {
  children: string;
}

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

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCallouts]}
        urlTransform={(url) => url}
        components={{ a: MarkdownAnchor, code: MarkdownCode }}
      >
        {toUnixNewlines(children)}
      </ReactMarkdown>
    </div>
  );
}
