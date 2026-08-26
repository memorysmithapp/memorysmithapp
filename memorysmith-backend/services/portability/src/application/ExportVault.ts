/**
 * Export use case (architecture-guide.md, section 16).
 *
 * The materialized tree is built from the Vault aggregate and its notes; the
 * content comes from the ContentStore through the CURRENT ContentRef of each
 * one. The numeric prefix is derived from the order at the moment of the
 * export and is never stored.
 *
 * Deleted notes do not enter the export (RN-PRT-006).
 */

import { DomainError, err, ok, ulid, type Instant, type Result } from '@memorysmith/kernel';
import { buildExportTree, type ExportFile, type ExportInput } from '../domain/ExportTree.js';

/** What the Knowledge context hands over for an export. */
export interface ExportSource {
  load(vaultId: string): Promise<ExportInput | null>;
}

/** Where the archive lands, and how the caller reaches it. */
export interface ArchiveStore {
  put(key: string, archive: Buffer): Promise<void>;
  presign(key: string, expiresInSeconds: number): Promise<string>;
}

export interface ExportJob {
  readonly exportId: string;
  readonly vaultId: string;
  readonly status: 'ready';
  readonly downloadUrl: string;
  readonly expiresAt: string;
  readonly noteCount: number;
  readonly bytes: number;
}

const URL_TTL_SECONDS = 900;

export class ExportVault {
  constructor(
    private readonly source: ExportSource,
    private readonly archives: ArchiveStore,
    private readonly zip: (files: ExportFile[], now: Date) => Buffer,
    private readonly subscriptionId: string,
  ) {}

  async execute(input: { vaultId: string; now: Instant }): Promise<Result<ExportJob, DomainError>> {
    const source = await this.source.load(input.vaultId);
    if (!source) return err(DomainError.notFound('Vault not found'));

    const files = buildExportTree(source);
    const archive = this.zip(files, new Date(input.now.epochMillis));

    const exportId = ulid();
    // The archive lives under the same subscription prefix as everything else.
    const key = `s/${this.subscriptionId}/exports/${exportId}.zip`;
    await this.archives.put(key, archive);

    return ok({
      exportId,
      vaultId: input.vaultId,
      status: 'ready',
      downloadUrl: await this.archives.presign(key, URL_TTL_SECONDS),
      expiresAt: input.now.plusDays(0).toISOString(),
      noteCount: source.notes.length,
      bytes: archive.length,
    });
  }
}
