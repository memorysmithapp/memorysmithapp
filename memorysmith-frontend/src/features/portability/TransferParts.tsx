import type { TransferDto } from '@memorysmith/contracts';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { formatBytes } from '../../shared/components/StorageBar';
import { progressOf } from './transfers';

/**
 * The pieces a transfer is drawn with, on the menu and on the page alike
 * (#205): what kind it is, what it is about, and what state it is in.
 */

/** A square with ↑ for an export and ↓ for an import. */
export function KindMark({ kind }: { kind: TransferDto['kind'] }) {
  return (
    <span className="transfer-kind" aria-hidden="true">
      {kind === 'export' ? '↑' : '↓'}
    </span>
  );
}

/** *Exportação · **Produção de Artigos***: the kind, then the notebook. */
export function TransferTitle({ transfer }: { transfer: TransferDto }) {
  const { t } = useTranslation();
  return (
    <span className="transfer-title">
      {t(`transfers.kind.${transfer.kind}`)} · <strong>{transfer.notebookName}</strong>
    </span>
  );
}

/**
 * The file and when: an export saves as a file named after its notebook, and
 * an import came *from* a file the person chose.
 */
export function TransferFile({ transfer }: { transfer: TransferDto }) {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(intlLocale(i18n.language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(transfer.requestedAt));
  const file = transfer.fileName
    ? transfer.kind === 'import'
      ? t('transfers.fromFile', { file: transfer.fileName })
      : transfer.fileName
    : null;
  return <span className="transfer-file">{file ? `${file} · ${when}` : when}</span>;
}

/** What a transfer that ended produced: the size of an export, the notes of an import. */
function outcome(
  transfer: TransferDto,
  t: (key: string, values?: Record<string, unknown>) => string,
  locale: string,
) {
  if (transfer.kind === 'export') return formatBytes(transfer.bytes, locale);
  return transfer.done > 0
    ? t('transfers.wrote', { count: transfer.done })
    : t('transfers.wroteNothing');
}

/**
 * The state: running is the words and a bar; ended is a chip with a dot in
 * the colour of what it means, *Pronta* green, *Falhou* red, *Cancelada* grey,
 * always with the word, and what it produced beside it.
 */
export function TransferState({ transfer }: { transfer: TransferDto }) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const progress = progressOf(transfer);

  if (transfer.status === 'running') {
    return (
      <span className="transfer-state is-running">
        <span className="transfer-state-text">
          {t(`transfers.running.${transfer.kind}`, { done: transfer.done, total: transfer.total })}
        </span>
        <span className="transfer-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
        </span>
      </span>
    );
  }

  return (
    <span className="transfer-state">
      <span className="state-chip" data-state={transfer.status}>
        {t(`transfers.state.${transfer.status}`)}
      </span>
      {transfer.status === 'ready' ? (
        <span className="transfer-outcome">{outcome(transfer, t, locale)}</span>
      ) : null}
    </span>
  );
}

/**
 * Why a transfer failed, in the words of the person. The API answers a code,
 * and an unexpected failure answers the message of the error it met, which is
 * nobody's words: that one reads as the generic refusal.
 */
export function failureOf(
  transfer: TransferDto,
  t: (key: string) => string,
  has: (key: string) => boolean,
): string | null {
  if (transfer.status !== 'failed') return null;
  const key = `portability.refusal.${transfer.failure ?? 'INTERNAL'}`;
  return has(key) ? t(key) : t('portability.refusal.INTERNAL');
}
