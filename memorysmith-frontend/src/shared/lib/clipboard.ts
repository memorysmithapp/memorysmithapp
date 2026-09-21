/**
 * Copying to the clipboard, in the one way that works everywhere the product
 * is opened.
 *
 * The async clipboard API can stay pending forever in embedded or automated
 * contexts, so the promise is raced against a short timeout and the legacy
 * path takes over when it does not settle. It was written for the note and is
 * here because the welcome surface copies the address of the connector (#167),
 * which is the one string in the product a person has to carry somewhere else.
 */
export async function copyText(text: string): Promise<void> {
  const viaApi = navigator.clipboard
    ?.writeText(text)
    .then(() => true)
    .catch(() => false);
  const done = await Promise.race([
    viaApi ?? Promise.resolve(false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 350)),
  ]);
  if (done) return;

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.style.position = 'fixed';
  scratch.style.opacity = '0';
  document.body.appendChild(scratch);
  scratch.select();
  document.execCommand('copy');
  scratch.remove();
}
