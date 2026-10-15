/**
 * The one writer of operation lines: Powertools for AWS Lambda, which writes
 * structured JSON with the service, the level and the timestamp, and reads its
 * service name and level from the environment the construct sets
 * (`POWERTOOLS_SERVICE_NAME`, `POWERTOOLS_LOG_LEVEL`).
 *
 * Every line passes through `sanitize`, so whatever a caller hands in, only the
 * fields of the allow-list are written (section 17).
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { OPERATION_MESSAGE, sanitize, type OperationLine } from './fields.js';

let logger: Logger | undefined;

function theLogger(): Logger {
  logger ??= new Logger();
  return logger;
}

/** Writes the line of one operation, at ERROR when it failed and INFO otherwise. */
export function writeOperation(line: OperationLine): void {
  try {
    const clean = sanitize(line as unknown as Record<string, unknown>);
    const attributes = clean as unknown as Record<string, unknown>;
    if (clean.outcome === 'error') theLogger().error(OPERATION_MESSAGE, attributes);
    else theLogger().info(OPERATION_MESSAGE, attributes);
  } catch {
    // A log line never takes the operation it describes down with it.
  }
}
