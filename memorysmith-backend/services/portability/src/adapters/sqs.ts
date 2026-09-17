/**
 * Where the work of a transfer is handed over (RN-PRT-019).
 *
 * The API records the transfer and sends one message; the worker does the
 * reading, the zipping and the writing, none of which fits in the 29 seconds
 * the function behind the API is allowed to live.
 */

import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs';
import type { TransferQueue, TransferWork } from '../application/Transfers.js';

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
