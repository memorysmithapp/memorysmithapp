import type { AnchorHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

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

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{ a: MarkdownAnchor }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
