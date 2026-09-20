/**
 * Dependency rules of the monorepo, run on every pull request
 * (architecture-guide.md, sections 5.1, 5.5 and 20 step 3).
 *
 * These are not style rules. Step 3 of the pipeline is what keeps "hexagonal"
 * from becoming folder naming in three sprints (PE1), and it is also where the
 * one-way direction between the three top-level projects is verified.
 *
 * The build breaks if domain/ imports the AWS SDK.
 */

const DOMAIN = '^memorysmith-backend/services/[^/]+/src/domain/';
const APPLICATION = '^memorysmith-backend/services/[^/]+/src/application/';
const ADAPTERS = '^memorysmith-backend/services/[^/]+/src/adapters/';
const KERNEL = '^memorysmith-backend/packages/kernel/';
const CONTRACTS = '^memorysmith-backend/packages/contracts/';

module.exports = {
  forbidden: [
    {
      name: 'domain-imports-only-kernel',
      comment:
        'domain/ imports only from itself and from packages/kernel. No SDK, no framework, ' +
        'no Zod, not even "just to grab a type" (PE1). The standard library of the runtime is ' +
        'not infrastructure and is allowed; the boundary is around the AWS SDK and frameworks.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        pathNot: [DOMAIN, KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'application-imports-domain-and-kernel',
      comment: 'application/ orchestrates domain and ports; it never reaches an adapter or an SDK.',
      severity: 'error',
      from: { path: APPLICATION },
      to: {
        pathNot: [DOMAIN, APPLICATION, KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'adapters-never-imported-by-the-inside',
      comment: 'Nothing inside the hexagon may import an adapter; only main/ wires them.',
      severity: 'error',
      from: { path: [DOMAIN, APPLICATION] },
      to: { path: ADAPTERS },
    },
    {
      name: 'no-service-to-service',
      comment:
        'Communication between contexts is HTTP with IAM auth or an event, never an import ' +
        '(architecture-guide.md, section 3.1).',
      severity: 'error',
      from: { path: '^memorysmith-backend/services/([^/]+)/' },
      to: {
        path: '^memorysmith-backend/services/([^/]+)/',
        pathNot: '^memorysmith-backend/services/$1/',
      },
    },
    {
      name: 'backend-never-imports-infra',
      comment:
        'Service code knowing the AWS account is the same leak PE1 prevents one layer down ' +
        '(architecture-guide.md, section 5.1).',
      severity: 'error',
      from: { path: '^memorysmith-backend/' },
      to: { path: '^memorysmith-infra/' },
    },
    {
      name: 'frontend-never-imports-infra',
      comment: 'The SPA knows the API at runtime and nothing about the account.',
      severity: 'error',
      from: { path: '^memorysmith-frontend/' },
      to: { path: '^memorysmith-infra/' },
    },
    {
      name: 'frontend-imports-contracts-only',
      comment:
        'The frontend imports @memorysmith/contracts — its types, and the constants it derives ' +
        'from the Markdown specification — and nothing else from the backend: not the kernel, ' +
        'not a service (architecture-guide.md, section 5.1).',
      severity: 'error',
      from: { path: '^memorysmith-frontend/' },
      to: {
        path: '^memorysmith-backend/',
        pathNot: CONTRACTS,
      },
    },
    {
      name: 'frontend-reads-the-specification-through-contracts',
      comment:
        'The Markdown specification is data the contracts derive from, in the package of the ' +
        'backend that holds it beside the document it belongs to (#162). The ' +
        'frontend reads the notation and its cases from @memorysmith/contracts, so the ' +
        'specification has one door into the interface and not two (architecture-guide.md, ' +
        'section 11.0).',
      severity: 'error',
      from: { path: '^memorysmith-frontend/' },
      // Both shapes: the package name, which is what an import the frontend does
      // not declare resolves to, and the real path, which is what a relative import
      // or a declared dependency resolves to.
      to: { path: '(^|/)packages/markdown-spec/|(^|/)@memorysmith/markdown-spec(/|$)' },
    },
    {
      name: 'infrastructure-never-loads-what-operates-it',
      comment:
        'The stacks, the constructs and the app describe infrastructure. The commands, the ' +
        'functional suite and the agent evaluation operate and test it ' +
        'from outside, through its surfaces, and a synth that loaded them would load their ' +
        'dependencies too (architecture-guide.md, section 5.4).',
      severity: 'error',
      from: { path: '^memorysmith-infra/(bin|config|stacks|constructs)/' },
      to: { path: '^memorysmith-infra/(commands|functional|agent-eval)/' },
    },
    {
      name: 'operations-reach-the-product-through-its-contracts',
      comment:
        'The commands, the functional suite and the agent evaluation reach the product the way ' +
        'anybody outside does, through its surfaces: of ' +
        'this repository they import @memorysmith/contracts and nothing else, not a service and ' +
        'not a stack (architecture-guide.md, section 5.4).',
      severity: 'error',
      from: { path: '^memorysmith-infra/(commands|functional|agent-eval)/' },
      to: {
        path: '^memorysmith-(backend|frontend)/|^memorysmith-infra/(bin|config|stacks|constructs)/',
        pathNot: CONTRACTS,
      },
    },
    {
      name: 'contracts-stay-standalone',
      comment:
        'The published language depends on nothing of ours: the frontend imports it, so a ' +
        'dependency here would drag the backend into the browser bundle. The one exception ' +
        'is the specification, which is DATA and no code: the contracts derive the notation ' +
        'from it rather than transcribing it, and it is the one door the notation has into ' +
        'the interface (architecture-guide.md, section 11.0, RN-AGT-022).',
      severity: 'error',
      from: { path: CONTRACTS },
      to: {
        path: '^memorysmith-(backend|frontend|infra)/',
        pathNot: [CONTRACTS, '(^|/)packages/markdown-spec/'],
      },
    },
    {
      name: 'kernel-stays-primitive',
      comment:
        'The shared kernel is primitives with no rule of their own. It imports nothing of ours ' +
        'and no SDK; a large shared kernel is coupling in disguise (section 3.1).',
      severity: 'error',
      from: { path: KERNEL },
      to: {
        pathNot: [KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'no-circular',
      comment: 'A cycle between modules means the boundary is not where it claims to be.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment:
        'Dead module: nothing imports it and it imports nothing. Lambda entrypoints are ' +
        'exempt, because what references them is the CDK, by path, and not an import.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](js|cjs|mjs|ts|json)$',
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)(babel|webpack|vite|vitest|playwright)[.](config|adapters[.]config)[.](js|cjs|mjs|ts|json)$',
          '(^|/)[.]dependency-cruiser[.]cjs$',
          '(^|/)(handler|lambda|relay[.]handler|pre-token-generation|custom-message)[.]ts$',
          '(^|/)eslint[.]config[.](js|cjs|mjs|ts)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    /*
     * Generated output, never source: the bundles of a synth, the coverage of
     * a run and the HTML report a functional run leaves behind — which ships
     * with a copy of the Playwright trace viewer, and cruising a bundled
     * viewer reports circular imports that are nobody's to fix.
     */
    exclude: { path: '(^|/)(node_modules|dist|cdk[.]out|coverage|functional-report)/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
