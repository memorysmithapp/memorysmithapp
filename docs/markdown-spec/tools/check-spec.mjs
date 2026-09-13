#!/usr/bin/env node
// The consistency check of the specification.
//
// A notation lives in three files at once — SPEC.md, spec.json and
// tests/conformance.json — and the failure this repository exists to prevent is the three
// of them drifting apart in silence. This is what refuses that in CI, and it is the whole
// of CI: no dependencies, no build, no network.
//
// It validates spec.json against schema/spec.schema.json with a validator that
// implements only the keywords the schema actually uses, and that FAILS on any keyword it
// does not implement. A validator that ignores what it does not understand is worse than
// no validator, because it reports success it did not establish.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const readJson = (relative) => {
  const text = readFileSync(join(root, relative), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(relative, `is not valid JSON — ${error.message}`);
    return null;
  }
};

const schema = readJson('schema/spec.schema.json');
const spec = readJson('spec.json');
const conformance = readJson('tests/conformance.json');
const specText = readFileSync(join(root, 'SPEC.md'), 'utf8');

if (!schema || !spec || !conformance) {
  report();
}

// ---------------------------------------------------------------------------
// A JSON Schema validator for the subset this repository uses.
// ---------------------------------------------------------------------------

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'examples']);
const IMPLEMENTED = new Set([
  'type',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'enum',
  'pattern',
  'format',
  'propertyNames',
]);

const typeOf = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

function validate(value, node, path) {
  for (const keyword of Object.keys(node)) {
    if (!ANNOTATIONS.has(keyword) && !IMPLEMENTED.has(keyword)) {
      fail('schema/spec.schema.json', `uses the keyword "${keyword}", which this checker does not implement. Implement it in tools/check-spec.mjs or drop it from the schema`);
    }
  }

  if (node.type) {
    const actual = typeOf(value);
    const expected = node.type === 'number' && actual === 'integer' ? 'number' : actual;
    if (expected !== node.type) {
      fail(path, `should be ${node.type} and is ${actual}`);
      return;
    }
  }

  if (node.enum && !node.enum.includes(value)) {
    fail(path, `is "${value}", which is not one of ${node.enum.map((v) => `"${v}"`).join(', ')}`);
  }

  if (node.pattern && typeof value === 'string' && !new RegExp(node.pattern).test(value)) {
    fail(path, `is "${value}", which does not match ${node.pattern}`);
  }

  if (node.format === 'uri' && typeof value === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    fail(path, `is "${value}", which is not an absolute URI`);
  }

  if (typeOf(value) === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in value)) fail(path, `is missing the required property "${key}"`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = node.properties?.[key];
      if (childSchema) {
        validate(child, childSchema, `${path}.${key}`);
      } else if (node.additionalProperties === false) {
        fail(path, `carries "${key}", which the schema does not declare`);
      }
    }
  }

  if (typeOf(value) === 'array') {
    if (node.minItems !== undefined && value.length < node.minItems) {
      fail(path, `holds ${value.length} items and the schema requires at least ${node.minItems}`);
    }
    if (node.items) {
      value.forEach((item, index) => validate(item, node.items, `${path}[${index}]`));
    }
  }
}

validate(spec, schema, 'spec.json');

// ---------------------------------------------------------------------------
// The three files have to agree.
// ---------------------------------------------------------------------------

const notations = spec.notations ?? [];
const cases = conformance.cases ?? [];

// Identifiers are stable: never renamed, never reused. Duplicates break that promise
// before anybody has a chance to rely on it.
const seenNotations = new Set();
for (const entry of notations) {
  if (seenNotations.has(entry.id)) fail('spec.json', `declares the notation "${entry.id}" twice`);
  seenNotations.add(entry.id);
}

const KINDS = new Set(['note', 'attachment', 'pending']);

const seenCases = new Set();
for (const testCase of cases) {
  if (seenCases.has(testCase.id)) fail('tests/conformance.json', `declares the case "${testCase.id}" twice`);
  seenCases.add(testCase.id);

  if (!testCase.notation) {
    fail('tests/conformance.json', `the case "${testCase.id}" names no notation`);
  } else if (!seenNotations.has(testCase.notation)) {
    fail('tests/conformance.json', `the case "${testCase.id}" exercises "${testCase.notation}", which spec.json does not declare`);
  }
  if (typeof testCase.markdown !== 'string') {
    fail('tests/conformance.json', `the case "${testCase.id}" carries no markdown input`);
  }
  if (
    !('links' in testCase) &&
    !('facets' in testCase) &&
    !('title' in testCase) &&
    !('resolution' in testCase)
  ) {
    fail('tests/conformance.json', `the case "${testCase.id}" claims neither a title, nor links, nor facets, nor a resolution, so it asserts nothing`);
  }

  // A resolution is a claim about a vault, and a vault is only there to be resolved
  // against. One without the other is half a case, and the half that is missing is the
  // one that would have made it fail.
  const hasVault = 'vault' in testCase;
  const hasResolution = 'resolution' in testCase;
  if (hasVault !== hasResolution) {
    fail(
      'tests/conformance.json',
      hasVault
        ? `the case "${testCase.id}" builds a vault and claims no resolution against it`
        : `the case "${testCase.id}" claims a resolution and gives no vault to resolve against`,
    );
  }

  if (hasVault) {
    const vault = testCase.vault ?? {};
    const notes = vault.notes ?? [];
    const attachments = vault.attachments ?? [];
    if (!Array.isArray(notes) || notes.some((note) => typeof note !== 'string')) {
      fail('tests/conformance.json', `the case "${testCase.id}" has a vault whose "notes" is not a list of Markdown documents`);
    }
    if (!Array.isArray(attachments) || attachments.some((name) => typeof name !== 'string')) {
      fail('tests/conformance.json', `the case "${testCase.id}" has a vault whose "attachments" is not a list of names`);
    }
    if (notes.length === 0 && attachments.length === 0) {
      fail('tests/conformance.json', `the case "${testCase.id}" has an empty vault, which resolves nothing`);
    }
  }

  for (const outcome of testCase.resolution ?? []) {
    const where = `the case "${testCase.id}"`;
    if (typeof outcome.target !== 'string') {
      fail('tests/conformance.json', `${where} has a resolution with no target`);
      continue;
    }
    if (!KINDS.has(outcome.kind)) {
      fail('tests/conformance.json', `${where} resolves "${outcome.target}" to the kind "${outcome.kind}", which is not one of ${[...KINDS].join(', ')}`);
    }
    if (!Number.isInteger(outcome.edges) || outcome.edges < 0) {
      fail('tests/conformance.json', `${where} resolves "${outcome.target}" to an edge count that is not a whole number`);
      continue;
    }
    // SPEC.md 5.4, 5.5 and 5.8: only a note produces an edge, and a note that matches
    // produces one per match.
    if (outcome.kind !== 'note' && outcome.edges !== 0) {
      fail('tests/conformance.json', `${where} resolves "${outcome.target}" to the kind ${outcome.kind} and to ${outcome.edges} edges. Only a note produces an edge`);
    }
    if (outcome.kind === 'note' && outcome.edges < 1) {
      fail('tests/conformance.json', `${where} resolves "${outcome.target}" to a note and to no edge`);
    }
  }
}

// Every notation an indexer decides needs a case. The ones whose reader is
// reading-surface are rendering, and what a callout looks like is not something a JSON
// file can assert — that is the one exception, and it is stated in CLAUDE.md.
const exercised = new Set(cases.map((testCase) => testCase.notation));
for (const entry of notations) {
  if (entry.reader !== 'reading-surface' && !exercised.has(entry.id)) {
    fail('tests/conformance.json', `has no case for "${entry.id}". A notation without a case is not part of the specification`);
  }
}

// ---------------------------------------------------------------------------
// Every section reference resolves to a real heading of SPEC.md.
// ---------------------------------------------------------------------------

const headings = new Set(
  [...specText.matchAll(/^#{2,6}\s+([0-9]+(?:\.[0-9]+)*)\.?\s/gm)].map((match) => match[1]),
);

for (const entry of notations) {
  if (!entry.spec) continue;
  for (const section of entry.spec.split(',').map((value) => value.trim())) {
    if (!headings.has(section)) {
      fail('spec.json', `the notation "${entry.id}" points at SPEC.md § ${section}, which has no heading`);
    }
  }
}

// The document points at itself constantly — a form is stated where an author meets it and
// again in the section that governs it — and a renumbering is what breaks all of those at
// once. Every § in the prose has to resolve too.
const danglingRefs = new Set();
for (const match of specText.matchAll(/§(\d+(?:\.\d+)*)/g)) {
  if (!headings.has(match[1])) danglingRefs.add(match[1]);
}
for (const section of [...danglingRefs].sort()) {
  fail('SPEC.md', `refers to § ${section}, which has no heading`);
}

// ---------------------------------------------------------------------------
// One canonical version, mirrored in three places.
//
// The mirrors are SPEC.md, tests/conformance.json and package.json, and every one of them
// is a place somebody forgets. This check exists because it already happened: 0.2.0 was
// released with the header of SPEC.md still saying 0.1.0.
// ---------------------------------------------------------------------------

const packageJson = readJson('package.json');
const specVersion = specText.match(/^\*\*Version\s+([0-9]+\.[0-9]+\.[0-9]+)\*\*/m)?.[1];

if (!specVersion) {
  fail('SPEC.md', 'carries no "**Version X.Y.Z**" line, so nothing can be checked against it');
} else if (specVersion !== spec.version) {
  fail('SPEC.md', `says version ${specVersion} and spec.json says ${spec.version}. The canonical version is the one in spec.json`);
}

if (conformance.version !== spec.version) {
  fail('tests/conformance.json', `says version ${conformance.version} and spec.json says ${spec.version}`);
}

if (packageJson && packageJson.version !== spec.version) {
  fail('package.json', `says version ${packageJson.version} and spec.json says ${spec.version}. The package is a distribution of the specification and carries its version`);
}

if (conformance.spec !== spec.spec) {
  fail('tests/conformance.json', `names the specification "${conformance.spec}" and spec.json names it "${spec.spec}"`);
}

report();

function report() {
  if (errors.length === 0) {
    const surface = notations.filter((entry) => entry.reader === 'reading-surface').length;
    console.log(
      `The specification is consistent: ${notations.length} notations (${notations.length - surface} an indexer decides, ${surface} rendering), ${cases.length} conformance cases, version ${spec.version}.`,
    );
    process.exit(0);
  }
  console.error(`The specification is inconsistent. ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}
