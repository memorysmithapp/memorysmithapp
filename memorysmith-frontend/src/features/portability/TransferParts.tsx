import type { TransferDto } from '@memorysmith/contracts';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { formatBytes } from '../../shared/components/StorageBar';
import { fileKind } from '../../shared/components/file-kind';
import { isStalled, progressOf } from './transfers';

/**
 * The pieces a transfer is drawn with, on the menu and on the page alike
 * (#205): what kind it is, what it is about, and what state it is in.
 */

/**
 * A square with ↑ for an export, ↓ for an import, ⇣ for what an agent is
 * sending — it arrives too, and in parts — and ? for a file it asked for.
 */
export function KindMark({ kind }: { kind: TransferDto['kind'] }) {
  return (
    <span className="transfer-kind" data-kind={kind} aria-hidden="true">
      {kind === 'export' ? '↑' : kind === 'import' ? '↓' : kind === 'request' ? '?' : '⇣'}
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
 * The file and when: an export saves as a file named after its notebook, an
 * import came *from* a file the person chose, and an upload of an agent is the
 * file it will become, sent through a connector the product names — never one
 * the agent declared (RN-PRT-028).
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
  // A connector names itself; an upload with none was started from the
  // interface, by the note editor (#242). A request names who asked (#253).
  const by = transfer.upload ?? transfer.request;
  const platform = !by
    ? null
    : by.platform
      ? t('transfers.platform', { platform: by.platform })
      : t('transfers.platformInterface');
  return (
    <span className="transfer-file">
      {[file, platform, when].filter((part): part is string => part !== null).join(' · ')}
    </span>
  );
}

/**
 * What an upload of an agent is for, in its words, and when its last part
 * arrived: the two things a person reads to recognise one stopped days ago.
 */
export function UploadPurpose({ transfer }: { transfer: TransferDto }) {
  const { t, i18n } = useTranslation();
  const upload = transfer.upload;
  const request = transfer.request;
  if (request) {
    // What the file is for, of what kind, and the size the agent knows of it —
    // a reference to recognise the file by, never a condition (RN-PRT-030).
    const known =
      request.expectedSize !== null
        ? t('transfers.requestKnown', {
            size: formatBytes(request.expectedSize, intlLocale(i18n.language)),
          })
        : null;
    return (
      <span className="transfer-purpose">
        {[request.purpose, fileKind(t, request.mimeType), known]
          .filter((part): part is string => Boolean(part))
          .join(' · ')}
      </span>
    );
  }
  if (!upload) return null;
  const last = upload.lastPartAt
    ? t('transfers.lastPart', {
        when: new Intl.DateTimeFormat(intlLocale(i18n.language), {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(upload.lastPartAt)),
      })
    : t('transfers.noPartYet');
  return (
    <span className="transfer-purpose">
      {upload.purpose}
      {transfer.status === 'running' ? ` · ${last}` : ''}
    </span>
  );
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
    // A request waits for the person, which is no progress to draw.
    if (transfer.kind === 'request') {
      return (
        <span className="transfer-state is-waiting">
          <span className="state-chip" data-state="waiting">
            {t('transfers.running.request')}
          </span>
        </span>
      );
    }
    // An upload that stopped says so, and still shows how far it got.
    const stalled = isStalled(transfer, Date.now());
    return (
      <span className={`transfer-state is-running${stalled ? ' is-stalled' : ''}`}>
        <span className="transfer-state-text">
          {t(stalled ? 'transfers.stalled' : `transfers.running.${transfer.kind}`, {
            done: transfer.done,
            total: transfer.total,
          })}
          {transfer.kind === 'agent' ? ` · ${formatBytes(transfer.bytes, locale)}` : ''}
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
