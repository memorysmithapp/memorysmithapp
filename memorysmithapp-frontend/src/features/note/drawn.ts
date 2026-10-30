import type { QueryClient } from '@tanstack/react-query';

/**
 * Resolves once what arrives after the text has arrived, or after ten seconds
 * — a picture that never loads may not keep a page drawn for paper, or for an
 * agent to see, from ever being done.
 *
 * Drawn means: no request in flight (a link to a file, a transcluded note),
 * every picture decoded or failed, no diagram still drawing, and the fonts in.
 * It has to hold twice in a row, because a request that ends can start the
 * next one — a transclusion arrives and asks for the picture it embeds.
 *
 * The print page (#258) and the preview page (#260) both wait on it, so what
 * the server captures of either is the note whole.
 */
export async function whenDrawn(root: HTMLElement | null, client: QueryClient): Promise<void> {
  const deadline = Date.now() + 10_000;
  await document.fonts.ready;
  let quiet = 0;
  while (Date.now() < deadline) {
    const settled =
      client.isFetching() === 0 &&
      // A `table` block marks itself busy until its rows arrive (§7.15).
      !root?.querySelector(
        '.mermaid-loading, .attachment-loading, .skeleton, [aria-busy="true"]',
      ) &&
      [...(root?.querySelectorAll('img') ?? [])].every((image) => image.complete);
    quiet = settled ? quiet + 1 : 0;
    if (quiet >= 2) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
