import rendererStyles from '@memorysmithapp/markdown-renderer/styles.css?url';
import katexStyles from 'katex/dist/katex.min.css?url';

/**
 * The stylesheets of the renderer and of KaTeX, brought by the first note a
 * screen draws, never by the entry (#547): a screen with no note on it, the
 * sign-in and Home included, never downloads them.
 *
 * The cascade is the order of the stylesheets in the document, not the order
 * they arrive in, and the application overrides rules of theirs at the same
 * specificity. So they are placed BEFORE the first stylesheet of the
 * application, in the order the entry used to import them, and a printed note
 * keeps the paper's colour behind it. Loaded as Vite loads a lazy chunk's
 * styles, after the application's, they won (#547).
 *
 * The promise is the one `use` waits on, so a note draws only once they hold:
 * the print page lays out its pages on the note as styled.
 */
type Settled = Promise<void>;
/** How React's `use` reads a promise it need not wait on. */
const fulfil = (promise: Promise<void>) =>
  Object.assign(promise, { status: 'fulfilled', value: undefined });

let ready: Settled | null = null;

function settled(): Settled {
  // Already fulfilled, so `use` reads it without suspending: a server render
  // has no document to load them into.
  return fulfil(Promise.resolve());
}

function place(href: string, before: Node | null): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.readingStyles = '';
    // A stylesheet that fails leaves the note to read, unstyled, rather than
    // a screen that never draws.
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.insertBefore(link, before);
  });
}

export function readingStyles(): Settled {
  if (ready) return ready;
  if (typeof document === 'undefined') return (ready = settled());
  const first = document.head.querySelector('link[rel="stylesheet"], style');
  const loading = Promise.all([place(rendererStyles, first), place(katexStyles, first)]).then(
    () => {
      fulfil(loading);
    },
  );
  return (ready = loading);
}
