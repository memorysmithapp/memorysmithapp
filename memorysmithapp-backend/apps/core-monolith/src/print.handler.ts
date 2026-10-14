/**
 * The renderer of prints and previews (#263, #260, RN-PRT-031, RN-PRT-032): a
 * function of its own, because it carries a browser.
 *
 * Each message is one note to draw, as the person who asked. A print opens the
 * page the print tab previews, with their session and their choices, and the
 * pages it lays are saved as a PDF; a preview opens the preview page with the
 * note, or the draft kept beside it, and what it draws is captured as a PNG.
 * Either is kept under their subscription, beside which nothing else is
 * written. When there is nothing to make — the note is not theirs to read, the
 * session ended, the page never finished — the reason is left where the file
 * would have been, so whoever polls says so instead of waiting.
 *
 * A message is never retried: a print or a preview is asked for by somebody
 * who is waiting on it, and a second attempt minutes later serves nobody. The
 * failure is the answer.
 */

import { S3Client } from '@aws-sdk/client-s3';
import type { PrintJob } from '@memorysmithapp/svc-portability/application/prints';
import type { PreviewJob } from '@memorysmithapp/svc-portability/application/previews';
import { S3PrintOutput } from '@memorysmithapp/svc-portability/adapters/prints';
import { S3PreviewOutput } from '@memorysmithapp/svc-portability/adapters/previews';
import {
  renderPreview,
  renderPrint,
  type RendererConfig,
} from '@memorysmithapp/svc-portability/adapters/chromium';
import {
  annotate,
  correlationIdOfRecord,
  errorFieldsOf,
  observe,
  refusedWith,
} from '@memorysmithapp/observability';

interface QueueEvent {
  Records?: Array<{
    body?: string;
    messageAttributes?: Record<string, { stringValue?: string } | undefined>;
  }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const s3 = new S3Client({});
const bucket = required('CONTENT_BUCKET');
const output = new S3PrintOutput(s3, bucket);
const previews = new S3PreviewOutput(s3, bucket);

/**
 * What the page may reach: the application it is opened on, the API it reads
 * the note from, the host its pictures are served on, and the fonts the
 * application loads. Nothing else leaves the function.
 */
const config: RendererConfig = {
  siteOrigin: required('SITE_ORIGIN'),
  allowedOrigins: [
    required('API_ORIGIN'),
    required('FILES_ORIGIN'),
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ],
  chromiumDirectory: process.env['CHROMIUM_DIRECTORY'] ?? '/opt',
};

async function print(job: PrintJob): Promise<void> {
  try {
    const rendered = await renderPrint(job, config);
    if (rendered.ok)
      await output.keep(job.subscriptionId, job.printId, rendered.pdf, rendered.name);
    else {
      // Why there is no file: the person is told the reason, and the line of
      // the job keeps its code. What the page said on the way is not written:
      // a message of a page may quote the note it was drawing (section 17).
      annotate(refusedWith(rendered.failure));
      await output.fail(job.subscriptionId, job.printId, rendered.failure);
    }
  } catch (error) {
    annotate({ outcome: 'error', ...errorFieldsOf(error) });
    await output.fail(job.subscriptionId, job.printId, 'FAILED');
  }
}

async function preview(job: PreviewJob): Promise<void> {
  try {
    const draft = job.draft ? await previews.draft(job.subscriptionId, job.previewId) : null;
    const drawn = await renderPreview(job, draft, config);
    if (drawn.ok) await previews.keep(job.subscriptionId, job.previewId, drawn);
    else {
      annotate(refusedWith(drawn.failure));
      await previews.fail(job.subscriptionId, job.previewId, drawn.failure);
    }
  } catch (error) {
    annotate({ outcome: 'error', ...errorFieldsOf(error) });
    await previews.fail(job.subscriptionId, job.previewId, 'FAILED');
  }
}

export async function handler(event: QueueEvent): Promise<void> {
  for (const record of event.Records ?? []) {
    const job = JSON.parse(record.body ?? '{}') as PrintJob | PreviewJob;
    // A print carries no kind: it was the only job this queue knew.
    const isPreview = 'kind' in job && job.kind === 'preview';
    // The line of the job: its kind and its subscription, never the token it
    // carries, the note it draws or the choices it was asked with (section 17).
    await observe(
      {
        operation: isPreview ? 'preview' : 'print',
        correlationId: correlationIdOfRecord(record),
        subscriptionId: job.subscriptionId,
      },
      () => (isPreview ? preview(job as PreviewJob) : print(job as PrintJob)),
    );
  }
}
