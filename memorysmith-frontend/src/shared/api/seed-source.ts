// Seed adapter: derives the vault model from the files under /seed/vaults,
// which are written in the product's export format. Folder order comes from
// the numeric prefix, README.md carries guidance (vault root) or the folder
// description, TEMPLATE.md carries the folder template, everything else is a
// note. File contents load lazily; only the path index is eager.

type Loader = () => Promise<string>;

const files = import.meta.glob('/seed/vaults/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, Loader>;

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
  description?: Loader;
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
    notes: [],
  };
  vault.folders.set(dirPath, folder);
  return folder;
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
      if (fileName === 'README.md') vault.guidance = load;
      continue;
    }

    const folder = ensureFolder(vault, rest.slice(0, -1));
    if (fileName === 'README.md') {
      folder.description = load;
    } else if (fileName === 'TEMPLATE.md') {
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

  for (const vault of vaults.values()) {
    for (const folder of vault.folders.values()) {
      folder.notes.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  cache = vaults;
  return vaults;
}
