import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '../lib/clipboard';
import { CheckIcon, CopyIcon } from './icons';

/**
 * The verb beside a thing that gets carried somewhere else (#194): the address
 * of the connector and every fenced block of a note. It says *Copied* with the
 * check for two seconds and goes back.
 *
 * The word is dropped at phone width and the icon stays, so the label lives in
 * `aria-label` and `title` too: whoever hears the page still hears *Copy*.
 *
 * The text is asked for at the moment of the click, because a block is copied
 * from what is on the page and not from a string held since it was drawn.
 */
export function CopyButton({
  text,
  className = '',
  disabled = false,
}: {
  text: () => string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await copyText(text());
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      className={`button is-small copy-action ${className}`.trim()}
      onClick={() => void copy()}
      disabled={disabled}
      aria-label={t('note.copy')}
      title={copied ? t('note.copied') : t('note.copy')}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span className="copy-action-label">{copied ? t('note.copied') : t('note.copy')}</span>
    </button>
  );
}
