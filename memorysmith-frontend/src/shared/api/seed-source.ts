// Seed adapter: derives the vault model from the files under /seed/vaults,
// which are written in the product's export format. GUIDANCE.md at the vault
// root carries the guidance, STRUCTURE.md next to it carries the annotated
// folder tree, TEMPLATE.md carries the folder template, everything else is a
// note. Note contents load lazily; only the path index and STRUCTURE.md are
// eager, which mirrors the real system: the structure comes from the item
// store and the content from the object store.

type Loader = () => Promise<string>;

const files = import.meta.glob('/seed/vaults/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, Loader>;

/** Eight small documents, and nothing renders without them. */
const structures = import.meta.glob('/seed/vaults/*/STRUCTURE.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface SeedFolder {
  dirPath: string;
  parentDirPath: string | null;
  name: string;
  position: number;
  slug: string;
  slugPath: string;
  description: string;
  template?: Loader;
  notes: SeedNote[];
}

export interface SeedNote {
  path: string;
  title: string;
  slug: string;
  folderDirPath: string;
  load: Loader;
}

export interface SeedVault {
  slug: string;
  guidance?: Loader;
  folders: Map<string, SeedFolder>;
  notesBySlug: Map<string, SeedNote>;
}

function parseDirName(dir: string): { name: string; position: number } {
  const match = /^(\d+)\s+(.*)$/.exec(dir);
  if (match) return { name: match[2] ?? dir, position: Number(match[1]) };
  return { name: dir, position: 0 };
}

function ensureFolder(vault: SeedVault, dirs: string[]): SeedFolder {
  const dirPath = dirs.join('/');
  const existing = vault.folders.get(dirPath);
  if (existing) return existing;

  const parentDirs = dirs.slice(0, -1);
  const parent = parentDirs.length ? ensureFolder(vault, parentDirs) : null;
  const { name, position } = parseDirName(dirs[dirs.length - 1] ?? '');
  const slug = slugify(name);
  const folder: SeedFolder = {
    dirPath,
    parentDirPath: parent ? parent.dirPath : null,
    name,
    position,
    slug,
    slugPath: parent ? `${parent.slugPath}/${slug}` : slug,
    description: '',
    notes: [],
  };
  vault.folders.set(dirPath, folder);
  return folder;
}

interface StructureEntry {
  /** The numbering of the line, `2.1.` read as [2, 1]. */
  readonly numbering: number[];
  readonly name: string;
  readonly description: string;
}

/**
 * Reads the annotated tree of STRUCTURE.md, whose format is declared in
 * software-vision.md 9.2 and written by the export. One line per folder:
 *
 *   2.1. **2026**: Emitidos neste exercicio. (5 notes, has TEMPLATE.md)
 *
 * Only the numbering, the name and the description are read back. The note
 * count and the template mark are derived data, and this adapter counts the
 * real files instead of trusting a number written into a document.
 */
function parseStructure(markdown: string): StructureEntry[] {
  const line = /^\s*([\d.]+)\.\s+\*\*(.+?)\/?\*\*:\s*(.*?)\s*(?:\((?:\d+\s+notes?)[^()]*\))?\s*$/;
  const entries: StructureEntry[] = [];
  for (const raw of markdown.split('\n')) {
    const match = line.exec(raw);
    if (!match) continue;
    const numbering = (match[1] ?? '')
      .split('.')
      .filter((part) => part.length > 0)
      .map(Number);
    if (numbering.length === 0 || numbering.some(Number.isNaN)) continue;
    entries.push({ numbering, name: match[2] ?? '', description: match[3] ?? '' });
  }
  return entries;
}

function pad(position: number): string {
  return String(position).padStart(2, '0');
}

/**
 * Walks the parsed tree and hands each folder its description. A folder that
 * holds neither a template nor a note left no directory behind in the export,
 * so it does not exist yet: it is created here, which is the whole reason the
 * structure travels as its own document.
 */
function applyStructure(vault: SeedVault, markdown: string): void {
  const dirsByNumbering = new Map<string, string[]>();

  for (const entry of parseStructure(markdown)) {
    const parentKey = entry.numbering.slice(0, -1).join('.');
    const parentDirs = entry.numbering.length === 1 ? [] : (dirsByNumbering.get(parentKey) ?? null);
    if (parentDirs === null) continue;

    const position = entry.numbering[entry.numbering.length - 1] ?? 0;
    const parentDirPath = parentDirs.length ? parentDirs.join('/') : null;
    const sibling = [...vault.folders.values()].find(
      (folder) => folder.parentDirPath === parentDirPath && folder.position === position,
    );

    const dirs = [
      ...parentDirs,
      sibling ? sibling.dirPath.split('/').pop()! : `${pad(position)} ${entry.name}`,
    ];
    const folder = ensureFolder(vault, dirs);
    folder.description = entry.description;
    dirsByNumbering.set(entry.numbering.join('.'), dirs);
  }
}

let cache: Map<string, SeedVault> | null = null;

export function seedVaults(): Map<string, SeedVault> {
  if (cache) return cache;
  const vaults = new Map<string, SeedVault>();

  for (const [path, load] of Object.entries(files)) {
    const parts = path.replace('/seed/vaults/', '').split('/');
    const vaultSlug = parts[0];
    if (!vaultSlug) continue;
    let vault = vaults.get(vaultSlug);
    if (!vault) {
      vault = { slug: vaultSlug, folders: new Map(), notesBySlug: new Map() };
      vaults.set(vaultSlug, vault);
    }

    const rest = parts.slice(1);
    const fileName = rest[rest.length - 1] ?? '';
    if (rest.length === 1) {
      if (fileName === 'GUIDANCE.md') vault.guidance = load;
      continue;
    }

    const folder = ensureFolder(vault, rest.slice(0, -1));
    if (fileName === 'TEMPLATE.md') {
      folder.template = load;
    } else {
      const title = fileName.replace(/\.md$/, '');
      const note: SeedNote = {
        path,
        title,
        slug: slugify(title),
        folderDirPath: folder.dirPath,
        load,
      };
      folder.notes.push(note);
      vault.notesBySlug.set(note.slug, note);
    }
  }

  for (const [path, markdown] of Object.entries(structures)) {
    const vaultSlug = path.replace('/seed/vaults/', '').split('/')[0];
    const vault = vaultSlug ? vaults.get(vaultSlug) : undefined;
    if (vault) applyStructure(vault, markdown);
  }

  for (const vault of vaults.values()) {
    for (const folder of vault.folders.values()) {
      folder.notes.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  cache = vaults;
  return vaults;
}
