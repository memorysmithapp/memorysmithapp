/**
 * What the functional suite has to cover, and what it declares it covers
 * (architecture-guide.md, section 19).
 *
 * A case declares what it covers in its title — `[tool:create_note]`,
 * `[route:POST /knowledge/notebooks/:v/notes]`,
 * `[page:/notebooks/:notebookId/graph]` — and coverage is read off the source of
 * the specs, not off a run: a case that failed before reaching a line is still
 * the case that exists, and the run reports its failure on its own.
 *
 * What has to be covered is read from where each surface declares itself: the
 * live `tools/list` of the connector, the route manifest of the core and the
 * router of the interface. A tool, a route or a page added without a case fails
 * the suite, and so does a case naming one that is gone.
 */

export type Surface = 'tool' | 'route' | 'page';

const DECLARATION = /\[(tool|route|page):([^\]]+)\]/g;

export function declaredCases(sources: readonly string[]): Record<Surface, Set<string>> {
  const declared: Record<Surface, Set<string>> = {
    tool: new Set(),
    route: new Set(),
    page: new Set(),
  };
  for (const source of sources) {
    for (const match of source.matchAll(DECLARATION)) {
      declared[match[1] as Surface].add((match[2] ?? '').trim());
    }
  }
  return declared;
}

export interface CoverageGap {
  /** Required, and no case declares it. */
  readonly missing: readonly string[];
  /** Declared by a case, and no longer required: the case names what is gone. */
  readonly unknown: readonly string[];
}

export function coverageGap(
  required: readonly string[],
  declared: ReadonlySet<string>,
): CoverageGap {
  const wanted = new Set(required);
  return {
    missing: [...wanted].filter((item) => !declared.has(item)).sort(),
    unknown: [...declared].filter((item) => !wanted.has(item)).sort(),
  };
}

/** The sentence a failing check prints, or null when nothing is missing. */
export function describeGap(surface: Surface, gap: CoverageGap): string | null {
  const lines = [
    ...gap.missing.map((item) => `no case covers the ${surface} ${item}`),
    ...gap.unknown.map((item) => `a case covers the ${surface} ${item}, which no longer exists`),
  ];
  return lines.length > 0 ? lines.join('\n') : null;
}

interface Frame {
  segment: string | null;
  index: boolean;
  children: boolean;
}

const ROUTER_TOKEN = /[{}]|path:\s*'([^']*)'|index:\s*true|children:/g;

/**
 * The pages of the router, as full paths, read from the source of the call to
 * `createBrowserRouter`: building the router needs a browser, and reading its
 * table does not. Only a route with no children is a page; a route that lays
 * its children out is not, and its index child is the page at its path.
 */
export function pagesOf(routerSource: string): string[] {
  const start = routerSource.indexOf('createBrowserRouter(');
  if (start < 0) throw new Error('The router source never calls createBrowserRouter.');

  const stack: Frame[] = [];
  const pages: string[] = [];
  for (const match of routerSource.slice(start).matchAll(ROUTER_TOKEN)) {
    const [text, path] = match;
    const top = stack[stack.length - 1];
    if (text === '{') {
      stack.push({ segment: null, index: false, children: false });
    } else if (text === '}') {
      const frame = stack.pop();
      if (frame && !frame.children && (frame.segment !== null || frame.index)) {
        pages.push(fullPath([...stack.map((each) => each.segment), frame.segment]));
      }
    } else if (top && text.startsWith('path')) {
      top.segment = path ?? '';
    } else if (top && text.startsWith('index')) {
      top.index = true;
    } else if (top && text === 'children:') {
      top.children = true;
    }
  }
  return pages;
}

function fullPath(segments: ReadonlyArray<string | null>): string {
  let path = '';
  for (const segment of segments) {
    if (segment === null) continue;
    path = segment.startsWith('/') ? segment : `${path.replace(/\/$/, '')}/${segment}`;
  }
  return path || '/';
}
