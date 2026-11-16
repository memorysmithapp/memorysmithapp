import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fileTypeOf, type NotebookFileDto } from '@memorysmithapp/contracts';
import type { TFunction } from 'i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { FileDrop } from '../../shared/components/FileDrop';
import { fileKind } from '../../shared/components/file-kind';
import { formatBytes } from '../../shared/components/StorageBar';
import { Modal } from '../../shared/components/Modal';
import {
  checkOriginal,
  PIXEL_CEILING,
  type CheckPhase,
  type CheckReport,
  type FileSide,
  type ImageFacts,
  type PixelVerdict,
} from './original';
import { keepOriginal, OriginalRefusal, type KeepOriginalPhase } from './keep-original';
import { checkPorts, keepOriginalPorts } from './original-ports';

type State =
  | { step: 'pick' }
  | { step: 'checking'; now: CheckPhase }
  | { step: 'report'; file: File; report: CheckReport }
  | { step: 'keeping'; file: File; report: CheckReport; now: KeepOriginalPhase }
  | { step: 'kept'; identical: boolean }
  | {
      step: 'failed';
      message: string;
      /** The copy was already let go: the original is offered again. */
      retry: { file: File; report: CheckReport } | null;
    };

/**
 * The check of a kept file against the person's original, and the question it
 * ends with (#466, RN-KNW-090, RN-KNW-091).
 *
 * The person chooses their file; it is hashed and read here and nothing of it
 * leaves the browser until they answer yes. The same size and SHA-256 is the
 * original. Anything else is shown side by side — what each one's bytes are,
 * and for an image what the picture is — and the page asks whether to keep
 * theirs in the place of the copy; only whoever may write content is asked.
 */
export function CheckOriginal({
  notebookId,
  file: kept,
  writable,
  onClose,
}: {
  notebookId: string;
  file: NotebookFileDto;
  writable: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const client = useQueryClient();
  const [state, setState] = useState<State>({ step: 'pick' });

  async function check(file: File): Promise<void> {
    setState({ step: 'checking', now: { phase: 'hashing', read: 0, total: file.size } });
    try {
      const report = await checkOriginal(checkPorts(notebookId, kept.fileId), kept, file, (now) =>
        setState({ step: 'checking', now }),
      );
      setState({ step: 'report', file, report });
    } catch (error) {
      setState({ step: 'failed', message: t(messageKeyOf(error)), retry: null });
    }
  }

  async function keep(file: File, report: CheckReport): Promise<void> {
    if (report.identical) return;
    let lettingGo = false;
    setState({ step: 'keeping', file, report, now: { phase: 'hashing', read: 0, total: 1 } });
    try {
      const answer = await keepOriginal(
        keepOriginalPorts(notebookId, kept),
        {
          notebookId,
          kept,
          file,
          sha256: report.local.sha256,
          purpose: t('attachments.check.purpose', { name: kept.name }),
        },
        (now) => {
          if (now.phase === 'letting-go') lettingGo = true;
          setState({ step: 'keeping', file, report, now });
        },
      );
      setState({ step: 'kept', identical: answer.identical });
    } catch (error) {
      const message =
        error instanceof OriginalRefusal
          ? t(`attachments.check.refusal.${error.reason}`)
          : error instanceof ApiError && error.code !== 'INTERNAL'
            ? error.message
            : t(messageKeyOf(error));
      setState({
        step: 'failed',
        message: lettingGo ? t('attachments.check.failedAfterLettingGo', { message }) : message,
        retry: lettingGo ? { file, report } : null,
      });
    } finally {
      // The notes reach the file by name: the list they resolve it from is read again.
      void client.invalidateQueries({ queryKey: queryKeys.notebookFiles(notebookId) });
      void client.invalidateQueries({ queryKey: queryKeys.subscriptionUsage() });
    }
  }

  const percent = (part: number, total: number) =>
    new Intl.NumberFormat(locale, { style: 'percent' }).format(total > 0 ? part / total : 0);

  const busy = state.step === 'checking' || state.step === 'keeping';

  let body: ReactNode;
  let actions: ReactNode = null;
  switch (state.step) {
    case 'pick':
      body = (
        <>
          <p className="check-original-lead">{t('attachments.check.lead')}</p>
          <FileDrop onFile={(file) => void check(file)} />
        </>
      );
      break;
    case 'checking':
      body = (
        <p className="check-original-status" role="status">
          {state.now.phase === 'hashing'
            ? t('attachments.check.hashing', { percent: percent(state.now.read, state.now.total) })
            : state.now.phase === 'reading'
              ? t('attachments.check.reading')
              : t('attachments.check.comparing')}
        </p>
      );
      break;
    case 'report':
    case 'keeping': {
      const { report } = state;
      body = (
        <>
          <CheckReportView name={kept.name} report={report} writable={writable} />
          {state.step === 'keeping' ? (
            <p className="check-original-status" role="status">
              {state.now.phase === 'letting-go'
                ? t('attachments.check.lettingGo')
                : state.now.phase === 'sending'
                  ? t('editor.attachSending', {
                      sent: Math.min(state.now.sent + 1, state.now.total),
                      total: state.now.total,
                    })
                  : t('attachments.check.preparing')}
            </p>
          ) : null}
        </>
      );
      if (report.identical) {
        actions = (
          <button type="button" className="button is-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        );
      } else if (writable) {
        const file = state.file;
        actions = (
          <>
            <button type="button" className="button" disabled={busy} onClick={onClose}>
              {t('attachments.check.keepNo')}
            </button>
            <button
              type="button"
              className="button is-primary"
              disabled={busy}
              onClick={() => void keep(file, report)}
            >
              {t('attachments.check.keepYes')}
            </button>
          </>
        );
      } else {
        actions = (
          <button type="button" className="button" onClick={onClose}>
            {t('common.close')}
          </button>
        );
      }
      break;
    }
    case 'kept':
      body = (
        <p
          className={`check-original-verdict ${state.identical ? 'is-same' : 'is-different'}`}
          role="status"
        >
          {state.identical ? t('attachments.check.kept') : t('attachments.check.keptDiffers')}
        </p>
      );
      actions = (
        <button type="button" className="button is-primary" onClick={onClose}>
          {t('common.close')}
        </button>
      );
      break;
    case 'failed': {
      const retry = state.retry;
      body = (
        <p className="check-original-status is-failure" role="alert">
          {state.message}
        </p>
      );
      actions = retry ? (
        <button
          type="button"
          className="button is-primary"
          onClick={() => void keep(retry.file, retry.report)}
        >
          {t('attachments.check.retry')}
        </button>
      ) : (
        <button type="button" className="button" onClick={() => setState({ step: 'pick' })}>
          {t('attachments.check.pickAgain')}
        </button>
      );
      break;
    }
  }

  return (
    <Modal
      open
      title={t('attachments.check.title')}
      subtitle={kept.name}
      className="check-original-dialog"
      onClose={onClose}
      actions={actions}
    >
      {body}
    </Modal>
  );
}

/**
 * What the check found, and the question it ends with when the two differ:
 * the person's answer is asked with the differences in sight.
 */
export function CheckReportView({
  name,
  report,
  writable,
}: {
  /** The name of the kept file. */
  name: string;
  report: CheckReport;
  writable: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  if (report.identical) {
    return (
      <>
        <p className="check-original-verdict is-same" role="status">
          {t('attachments.check.identical')}
        </p>
        <p className="check-original-hash">
          SHA-256 <code>{report.sha256}</code>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="check-original-verdict is-different" role="status">
        {t('attachments.check.differs')}
      </p>
      <Differences
        t={t}
        locale={locale}
        kept={report.kept}
        local={report.local}
        keptUnread={report.keptUnread}
      />
      {report.keptUnread ? (
        <p className="check-original-note">{t('attachments.check.keptUnread')}</p>
      ) : null}
      {report.pixels ? (
        <p className="check-original-note">
          <PixelsLine t={t} locale={locale} verdict={report.pixels} />
        </p>
      ) : null}
      <p className="check-original-ask">
        {writable ? t('attachments.check.ask', { name }) : t('attachments.check.askReadOnly')}
      </p>
    </>
  );
}

/** The words for a type read from the bytes, including the few the product does not keep. */
function kindOf(t: TFunction, type: string | null): string {
  if (type === null) return t('attachments.check.typeUnknown');
  if (fileTypeOf(type)) return fileKind(t, type);
  return t(`attachments.check.kinds.${type.replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: type });
}

function Differences({
  t,
  locale,
  kept,
  local,
  keptUnread,
}: {
  t: TFunction;
  locale: string;
  kept: FileSide;
  local: FileSide;
  keptUnread: boolean;
}) {
  const yesNo = (facts: ImageFacts | null, key: 'alpha' | 'icc' | 'exif') =>
    facts ? (facts[key] ? t('attachments.check.yes') : t('attachments.check.no')) : '—';
  const rows: { label: string; kept: ReactNode; local: ReactNode }[] = [
    {
      label: t('attachments.check.rowSize'),
      kept: formatBytes(kept.bytes, locale),
      local: formatBytes(local.bytes, locale),
    },
    {
      label: t('attachments.check.rowType'),
      kept: keptUnread ? '—' : kindOf(t, kept.type),
      local: kindOf(t, local.type),
    },
  ];
  if (kept.image || local.image) {
    const dimensions = (facts: ImageFacts | null) =>
      facts?.width && facts.height
        ? t('attachments.check.dimensions', { width: facts.width, height: facts.height })
        : '—';
    const color = (facts: ImageFacts | null) =>
      facts?.color ? t(`attachments.check.color.${facts.color}`) : '—';
    rows.push(
      {
        label: t('attachments.check.rowDimensions'),
        kept: dimensions(kept.image),
        local: dimensions(local.image),
      },
      {
        label: t('attachments.check.rowColor'),
        kept: color(kept.image),
        local: color(local.image),
      },
      {
        label: t('attachments.check.rowAlpha'),
        kept: yesNo(kept.image, 'alpha'),
        local: yesNo(local.image, 'alpha'),
      },
      {
        label: t('attachments.check.rowIcc'),
        kept: yesNo(kept.image, 'icc'),
        local: yesNo(local.image, 'icc'),
      },
      {
        label: t('attachments.check.rowExif'),
        kept: yesNo(kept.image, 'exif'),
        local: yesNo(local.image, 'exif'),
      },
    );
  }
  rows.push({
    label: 'SHA-256',
    kept: <code title={kept.sha256}>{shortHash(kept.sha256)}</code>,
    local: <code title={local.sha256}>{shortHash(local.sha256)}</code>,
  });
  return (
    <table className="check-original-table">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">{t('attachments.check.columnWhat')}</span>
          </th>
          <th scope="col">{t('attachments.check.columnKept')}</th>
          <th scope="col">{t('attachments.check.columnLocal')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const differs =
            typeof row.kept === 'string' && typeof row.local === 'string'
              ? row.kept !== row.local
              : true;
          return (
            <tr key={row.label} className={differs ? 'is-different' : undefined}>
              <th scope="row">{row.label}</th>
              <td>{row.kept}</td>
              <td>{row.local}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PixelsLine({
  t,
  locale,
  verdict,
}: {
  t: TFunction;
  locale: string;
  verdict: PixelVerdict;
}) {
  if (verdict.kind === 'over-ceiling') {
    return (
      <>
        {t('attachments.check.overCeiling', {
          megapixels: new Intl.NumberFormat(locale).format(PIXEL_CEILING / 1_000_000),
        })}
      </>
    );
  }
  if (verdict.kind === 'undrawable') return <>{t('attachments.check.undrawable')}</>;
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  if (verdict.identicalShare === 1) {
    return <>{t('attachments.check.pixelsSame', { samples: number(verdict.samples, 0) })}</>;
  }
  return (
    <>
      {t('attachments.check.pixels', {
        share: new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: 2,
        }).format(verdict.identicalShare),
        samples: number(verdict.samples, 0),
        mean: number(verdict.meanDifference, 1),
        peak: number(verdict.peakDifference, 0),
      })}
    </>
  );
}

/** The start and the end of a hash, the whole of it in the title and the copy. */
export function shortHash(sha256: string): string {
  return `${sha256.slice(0, 12)}…${sha256.slice(-6)}`;
}
