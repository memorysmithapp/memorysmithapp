import { lazy, Suspense, type ComponentType } from 'react';

/**
 * A page that arrives when it is opened (#547). The entry of the application
 * carries the shell, the session and the translations, and each screen brings
 * what it draws: the renderer, KaTeX, Mermaid, the graph and the charts reach
 * only the screens that use them. The files of an earlier release stay served
 * (`prune: false`), so a tab opened before a release still finds the page it
 * asks for.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  const Lazy = lazy(async () => ({ default: await load() }));
  return function LazyPage(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
