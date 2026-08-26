/**
 * Chunking for the vector index (architecture-guide.md, section 11.2).
 *
 * One chunk is roughly one idea, cut at headings. THE CONTEXT PREFIX IS THE
 * DETAIL THAT DECIDES QUALITY: a loose chunk ("the ceiling is 200 per account")
 * is unrecoverable, while the same chunk preceded by
 * `Product Research > Evidence > Facts observed in the field > Custom asset
 * capacities` is findable. The folder description, already written to steer the
 * agent, becomes a retrieval signal for free: the same text working twice.
 *
 * That is also why moving a note between folders invalidates its vectors
 * (RN-DSC-012): the prefix is part of the embedded text, so the meaning of the
 * chunk changed even though its words did not.
 */

export interface ChunkContext {
  readonly vaultName: string;
  readonly folderPath: string[];
  readonly folderDescription: string;
  readonly noteTitle: string;
}

export interface Chunk {
  /** Stable within the note, so a re-index can compare hashes per chunk. */
  readonly index: number;
  /** The heading this chunk sits under, cited alongside every hit. */
  readonly section: string | null;
  /** The text as written, which is what the caller reads. */
  readonly text: string;
  /** The text as embedded, prefix included. */
  readonly embedded: string;
}

const MAX_CHARS = 2000;

export function chunkNote(markdown: string, context: ChunkContext): Chunk[] {
  const sections = splitBySection(stripFrontmatter(markdown));
  const chunks: Chunk[] = [];

  for (const section of sections) {
    for (const piece of splitLong(section.body)) {
      if (piece.trim().length === 0) continue;
      chunks.push({
        index: chunks.length,
        section: section.heading,
        text: piece.trim(),
        embedded: `${prefixOf(context, section.heading)}\n\n${piece.trim()}`,
      });
    }
  }

  // A note with no body at all still deserves one chunk: its title is content.
  if (chunks.length === 0) {
    chunks.push({
      index: 0,
      section: null,
      text: context.noteTitle,
      embedded: prefixOf(context, null),
    });
  }
  return chunks;
}

function prefixOf(context: ChunkContext, heading: string | null): string {
  const parts = [
    context.vaultName,
    ...context.folderPath,
    context.folderDescription,
    context.noteTitle,
    ...(heading ? [heading] : []),
  ].filter((part) => part.length > 0);
  return parts.join(' > ');
}

export function stripFrontmatter(markdown: string): string {
  return markdown.startsWith('---')
    ? markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    : markdown;
}

interface Section {
  heading: string | null;
  body: string;
}

function splitBySection(markdown: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let heading: string | null = null;
  let body: string[] = [];

  const flush = (): void => {
    if (body.join('\n').trim().length > 0 || heading) {
      sections.push({ heading, body: body.join('\n') });
    }
  };

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = (match[2] ?? '').trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  flush();
  return sections.length > 0 ? sections : [{ heading: null, body: markdown }];
}

/** A very long section is cut at paragraph boundaries, never mid-sentence. */
function splitLong(body: string): string[] {
  if (body.length <= MAX_CHARS) return [body];
  const paragraphs = body.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length > MAX_CHARS && current.length > 0) {
      pieces.push(current);
      current = paragraph;
    } else {
      current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    }
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}
