import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPrint, startPrint } from '../../shared/api/backend';
import { ApiError } from '../../shared/api/error-mapper';
import { identifierOf } from '../../shared/api/note-address';
import { useNotebookId } from '../structure/route-ids';

/** How often the print is asked about while the server makes it. */
const POLL_MILLIS = 1500;

/**
 * How long the tab waits before it says the PDF did not come: longer than the
 * server's own deadline for a print (three minutes, `PRINT_DEADLINE_MILLIS`),
 * which answers `TIMED_OUT` first whenever the API is reached.
 */
const WAIT_MILLIS = 3.5 * 60 * 1000;

/** Why there is no PDF, as the tab says it. */
type Failure = 'gone' | 'failed' | 'timedOut';

/**
 * The steps a PDF goes through, as the tab can know them (#538): the request
 * until the server answers it, the pages while the server lays them out, and
 * the file once it is ready, until the tab becomes it. The server says only
 * running, ready or failed, so no step claims a share of the work.
 */
const STEPS = ['asking', 'laying', 'opening'] as const;
type Step = (typeof STEPS)[number];

/**
 * The PDF of a note, opened in a tab of its own (#522, RN-PRT-031).
 *
 * The note's *Generate PDF* opens this tab inside the click, so no pop-up
 * blocker stands between the click and the file. The tab asks the server for
 * the PDF — drawn by a browser of the server from the print page, as the
 * notebook's style lays it (#263, #493) — waits until it is made and then
 * becomes it: the browser shows the PDF, and the person prints it or saves it
 * from the browser's own viewer. There is no preview to print from first.
 *
 * While it waits, it shows the step the PDF is on and the seconds since it
 * was asked for (#538). It never waits forever. A note that is gone, or that the person no longer
 * reads, says so; a print that failed or did not come in time offers to try
 * again, which asks for a new one. A session that ended is the request's to
 * handle, as on every page: it asks to sign in.
 */
export function GeneratePdfPage() {
  const { t, i18n } = useTranslation();
  const notebookId = useNotebookId();
  const noteId = identifierOf(useParams().noteId);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [step, setStep] = useState<Step>('asking');
  const [since, setSince] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!noteId) {
      setFailure('gone');
      return;
    }
    let alive = true;
    setFailure(null);
    setStep('asking');
    setSince(Date.now());
    setElapsed(0);
    const locale = i18n.language === 'pt_BR' ? 'pt_BR' : 'en_US';
    void (async () => {
      try {
        const started = await startPrint(notebookId, noteId, { locale });
        if (alive) setStep('laying');
        const deadline = Date.now() + WAIT_MILLIS;
        while (alive && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MILLIS));
          if (!alive) return;
          const print = await getPrint(started.printId);
          const shown = print.url ?? print.downloadUrl;
          if (print.status === 'ready' && shown) {
            setStep('opening');
            // The tab becomes the file; going back does not return to the wait.
            window.location.replace(shown);
            return;
          }
          if (print.status === 'failed') {
            if (alive) setFailure(failureOf(print.failure));
            return;
          }
        }
        if (alive) setFailure('timedOut');
      } catch (error) {
        if (!alive) return;
        const gone = error instanceof ApiError && (error.status === 404 || error.status === 403);
        setFailure(gone ? 'gone' : 'failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [notebookId, noteId, attempt, i18n.language]);

  // The seconds since the PDF was asked for, while it is still awaited (#538).
  useEffect(() => {
    if (failure !== null) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [failure, since]);

  useEffect(() => {
    const before = document.title;
    document.title = t('pdf.title');
    return () => {
      document.title = before;
    };
  }, [t]);

  return (
    <div className="login-screen pdf-screen">
      <div className="login-card" aria-busy={failure === null}>
        <h1 className="brand-word">
          MemorySmith<span className="brand-suffix">.app</span>
        </h1>
        {failure === null ? <p className="login-note">{t('pdf.making')}</p> : null}
        <ol className="pdf-steps">
          {STEPS.map((each, index) => {
            const at = STEPS.indexOf(step);
            const state =
              index < at ? 'done' : index > at ? 'todo' : failure === null ? 'current' : 'stopped';
            return (
              <li key={each} data-state={state} aria-current={index === at ? 'step' : undefined}>
                {t(`pdf.steps.${each}`)}
              </li>
            );
          })}
        </ol>
        {failure === null ? (
          <>
            {/* The step reaches a screen reader when it changes, not every second. */}
            <p className="visually-hidden" role="status">
              {t(`pdf.steps.${step}`)}
            </p>
            <div className="pdf-bar" role="progressbar" aria-label={t(`pdf.steps.${step}`)} />
            <p className="pdf-elapsed">
              {t('pdf.elapsed', { count: elapsed })} · {t('pdf.upTo')}
            </p>
          </>
        ) : (
          <>
            <p className="login-note" role="alert">
              {t(`pdf.${failure}`)}
            </p>
            {failure === 'gone' ? null : (
              <button
                type="button"
                className="button is-primary"
                onClick={() => setAttempt((count) => count + 1)}
              >
                {t('pdf.retry')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** What the tab says of a print that failed, by why the server says it did. */
function failureOf(reason: string | undefined): Failure {
  if (reason === 'NOT_FOUND') return 'gone';
  if (reason === 'TIMED_OUT') return 'timedOut';
  return 'failed';
}
