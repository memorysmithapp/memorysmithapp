/**
 * Where the work of a transfer is handed over (RN-PRT-019).
 *
 * The API records the transfer and sends one message; the worker does the
 * reading, the zipping and the writing, none of which fits in the 29 seconds
 * the function behind the API is allowed to live.
 */

import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { TransferQueue, TransferWork } from '../application/Transfers.js';
import type { PrintJob, PrintQueue } from '../application/Prints.js';
import type { PreviewJob, PreviewQueue } from '../application/Previews.js';

export class SqsTransferQueue implements TransferQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async send(work: TransferWork): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(work) }),
    );
  }
}

/** Where a print is handed to the renderer (#263), which opens a browser and draws the note. */
export class SqsPrintQueue implements PrintQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async send(job: PrintJob): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(job) }),
    );
  }
}

/**
 * Where a preview is handed to the renderer (#260): the queue of prints, which
 * the renderer reads, and the `kind` of the job tells the two apart.
 */
export class SqsPreviewQueue implements PreviewQueue {
  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async send(job: PreviewJob): Promise<void> {
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(job) }),
    );
  }
}
