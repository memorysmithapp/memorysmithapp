/**
 * Fails the build when the entry of the interface outgrows its budget (#547).
 *
 * The entry is what the browser downloads and runs before any screen draws,
 * the sign-in included: the shell, the session and the translations. Each
 * screen brings the rest when it opens, and this keeps a new import in the
 * shell from bringing the weight back unnoticed. The budget lives beside it,
 * in `entry-budget.json`.
 */

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const budget = JSON.parse(readFileSync(new URL('entry-budget.json', root), 'utf8'));
const html = readFileSync(new URL('dist/index.html', root), 'utf8');

const entries = {
  js: [...html.matchAll(/<script[^>]+src="\/(assets\/[^"]+\.js)"/g)].map((match) => match[1]),
  css: [...html.matchAll(/<link[^>]+href="\/(assets\/[^"]+\.css)"/g)].map((match) => match[1]),
};

let over = false;
for (const kind of ['js', 'css']) {
  const kB =
    entries[kind].reduce(
      (total, file) => total + gzipSync(readFileSync(new URL(`dist/${file}`, root))).length,
      0,
    ) / 1024;
  const limit = budget[kind];
  const line = `entry ${kind}: ${kB.toFixed(1)} kB gzip, budget ${limit} kB`;
  if (kB > limit) {
    over = true;
    console.error(`over  ${line}`);
  } else console.warn(`ok    ${line}`);
}

if (over) {
  console.error(
    'The entry outgrew its budget: load what a screen needs from that screen (lazyPage in src/app/router.tsx), or raise the budget in entry-budget.json on purpose.',
  );
  process.exit(1);
}
