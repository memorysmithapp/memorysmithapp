#!/usr/bin/env node
// The consistency check of the profile.
//
// A notation lives in three files at once — SPEC.md, profile.json and
// tests/conformance.json — and the failure this repository exists to prevent is the three
// of them drifting apart in silence. This is what refuses that in CI, and it is the whole
// of CI: no dependencies, no build, no network.
//
// It validates profile.json against schema/profile.schema.json with a validator that
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

const schema = readJson('schema/profile.schema.json');
const profile = readJson('profile.json');
const conformance = readJson('tests/conformance.json');
const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');

if (!schema || !profile || !conformance) {
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
      fail('schema/profile.schema.json', `uses the keyword "${keyword}", which this checker does not implement. Implement it in tools/check-profile.mjs or drop it from the schema`);
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

validate(profile, schema, 'profile.json');

// ---------------------------------------------------------------------------
// The three files have to agree.
// ---------------------------------------------------------------------------

const notations = profile.notations ?? [];
const cases = conformance.cases ?? [];

// Identifiers are stable: never renamed, never reused. Duplicates break that promise
// before anybody has a chance to rely on it.
const seenNotations = new Set();
for (const entry of notations) {
  if (seenNotations.has(entry.id)) fail('profile.json', `declares the notation "${entry.id}" twice`);
  seenNotations.add(entry.id);
}

const seenCases = new Set();
for (const testCase of cases) {
  if (seenCases.has(testCase.id)) fail('tests/conformance.json', `declares the case "${testCase.id}" twice`);
  seenCases.add(testCase.id);

  if (!testCase.notation) {
    fail('tests/conformance.json', `the case "${testCase.id}" names no notation`);
  } else if (!seenNotations.has(testCase.notation)) {
    fail('tests/conformance.json', `the case "${testCase.id}" exercises "${testCase.notation}", which profile.json does not declare`);
  }
  if (typeof testCase.markdown !== 'string') {
    fail('tests/conformance.json', `the case "${testCase.id}" carries no markdown input`);
  }
  if (!('links' in testCase) && !('facets' in testCase)) {
    fail('tests/conformance.json', `the case "${testCase.id}" claims neither links nor facets, so it asserts nothing`);
  }
}

// Every notation an indexer decides needs a case. The ones whose reader is
// reading-surface are rendering, and what a callout looks like is not something a JSON
// file can assert — that is the one exception, and it is stated in CLAUDE.md.
const exercised = new Set(cases.map((testCase) => testCase.notation));
for (const entry of notations) {
  if (entry.reader !== 'reading-surface' && !exercised.has(entry.id)) {
    fail('tests/conformance.json', `has no case for "${entry.id}". A notation without a case is not part of the profile`);
  }
}

// ---------------------------------------------------------------------------
// Every section reference resolves to a real heading of SPEC.md.
// ---------------------------------------------------------------------------

const headings = new Set(
  [...spec.matchAll(/^#{2,6}\s+([0-9]+(?:\.[0-9]+)*)\.?\s/gm)].map((match) => match[1]),
);

for (const entry of notations) {
  if (!entry.spec) continue;
  for (const section of entry.spec.split(',').map((value) => value.trim())) {
    if (!headings.has(section)) {
      fail('profile.json', `the notation "${entry.id}" points at SPEC.md § ${section}, which has no heading`);
    }
  }
}

// ---------------------------------------------------------------------------
// One canonical version, mirrored in three places.
// ---------------------------------------------------------------------------

const specVersion = spec.match(/^\*\*Version\s+([0-9]+\.[0-9]+\.[0-9]+)\*\*/m)?.[1];

if (!specVersion) {
  fail('SPEC.md', 'carries no "**Version X.Y.Z**" line, so nothing can be checked against it');
} else if (specVersion !== profile.version) {
  fail('SPEC.md', `says version ${specVersion} and profile.json says ${profile.version}. The canonical version is the one in profile.json`);
}

if (conformance.version !== profile.version) {
  fail('tests/conformance.json', `says version ${conformance.version} and profile.json says ${profile.version}`);
}

if (conformance.profile !== profile.profile) {
  fail('tests/conformance.json', `names the profile "${conformance.profile}" and profile.json names it "${profile.profile}"`);
}

report();

function report() {
  if (errors.length === 0) {
    const surface = notations.filter((entry) => entry.reader === 'reading-surface').length;
    console.log(
      `The profile is consistent: ${notations.length} notations (${notations.length - surface} an indexer decides, ${surface} rendering), ${cases.length} conformance cases, version ${profile.version}.`,
    );
    process.exit(0);
  }
  console.error(`The profile is inconsistent. ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}
