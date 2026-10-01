/**
 * The renderer of prints (#263, RN-PRT-031): a function of its own, because it
 * carries a browser.
 *
 * Each message is one note to print, as the person who asked: the browser
 * opens the page the print tab previews, with their session and their choices,
 * and the pages it lays are saved as a PDF under their subscription, beside
 * which nothing else is written. When there is no file to make — the note is
 * not theirs to read, the session ended, the page never finished — the reason
 * is left where the file would have been, so the screen that polls says so
 * instead of waiting.
 *
 * A message is never retried: a print is asked for by a person who is waiting
 * on it, and a second attempt minutes later serves nobody. The failure is the
 * answer.
 */

import { S3Client } from '@aws-sdk/client-s3';
import type { PrintJob } from '@memorysmith/svc-portability/application/prints';
import { S3PrintOutput } from '@memorysmith/svc-portability/adapters/prints';
import { renderPrint, type RendererConfig } from '@memorysmith/svc-portability/adapters/chromium';

interface QueueEvent {
  Records?: Array<{ body?: string }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const output = new S3PrintOutput(new S3Client({}), required('CONTENT_BUCKET'));

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

export async function handler(event: QueueEvent): Promise<void> {
  for (const record of event.Records ?? []) {
    const job = JSON.parse(record.body ?? '{}') as PrintJob;
    try {
      const rendered = await renderPrint(job, config);
      if (rendered.ok)
        await output.keep(job.subscriptionId, job.printId, rendered.pdf, rendered.name);
      else {
        // Why there is no file, with what the page said on the way: the person
        // is told the reason, and the log keeps how it came about.
        console.warn('The print made no file', {
          printId: job.printId,
          failure: rendered.failure,
          diagnostics: rendered.diagnostics,
        });
        await output.fail(job.subscriptionId, job.printId, rendered.failure);
      }
    } catch (error) {
      console.error('The print could not be made', {
        printId: job.printId,
        error: error instanceof Error ? error.message : String(error),
      });
      await output.fail(job.subscriptionId, job.printId, 'FAILED');
    }
  }
}
