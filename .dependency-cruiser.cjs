/**
 * Dependency rules of the monorepo, run on every pull request (INV-03).
 *
 * These are not style rules. Step 3 of the pipeline is what keeps "hexagonal"
 * from becoming folder naming in three sprints (PE1), and it is also where the
 * one-way direction between the three top-level projects is verified.
 *
 * The build breaks if domain/ imports the AWS SDK.
 */

const DOMAIN = '^memorysmithapp-backend/services/[^/]+/src/domain/';
const APPLICATION = '^memorysmithapp-backend/services/[^/]+/src/application/';
const ADAPTERS = '^memorysmithapp-backend/services/[^/]+/src/adapters/';
const KERNEL = '^memorysmithapp-backend/packages/kernel/';
const CONTRACTS = '^memorysmithapp-backend/packages/contracts/';

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
      comment: 'Communication between contexts is HTTP with IAM auth or an event, never an import.',
      severity: 'error',
      from: { path: '^memorysmithapp-backend/services/([^/]+)/' },
      to: {
        path: '^memorysmithapp-backend/services/([^/]+)/',
        pathNot: '^memorysmithapp-backend/services/$1/',
      },
    },
    {
      name: 'backend-never-imports-infra',
      comment:
        'Service code knowing the AWS account is the same leak PE1 prevents one layer down ' +
        '(INV-03).',
      severity: 'error',
      from: { path: '^memorysmithapp-backend/' },
      to: { path: '^memorysmithapp-infra/' },
    },
    {
      name: 'frontend-never-imports-infra',
      comment: 'The SPA knows the API at runtime and nothing about the account.',
      severity: 'error',
      from: { path: '^memorysmithapp-frontend/' },
      to: { path: '^memorysmithapp-infra/' },
    },
    {
      name: 'frontend-imports-contracts-only',
      comment:
        'The frontend imports @memorysmithapp/contracts — its types, and the constants it derives ' +
        'from the Markdown specification — and nothing else from the backend: not the kernel, ' +
        'not a service (INV-03).',
      severity: 'error',
      from: { path: '^memorysmithapp-frontend/' },
      to: {
        path: '^memorysmithapp-backend/',
        pathNot: CONTRACTS,
      },
    },
    {
      name: 'frontend-reads-the-specification-through-contracts',
      comment:
        'The Markdown specification is data the contracts derive from, published as ' +
        '@memorysmithapp/markdown-spec. The frontend reads the notation and its cases from ' +
        '@memorysmithapp/contracts, so the specification has one door into the interface and ' +
        'not two.',
      severity: 'error',
      from: { path: '^memorysmithapp-frontend/' },
      to: { path: '(^|/)@memorysmithapp/markdown-spec(/|$)' },
    },
    {
      name: 'infrastructure-never-loads-what-operates-it',
      comment:
        'The stacks, the constructs and the app describe infrastructure. The commands, the ' +
        'functional suite and the agent evaluation operate and test it ' +
        'from outside, through its surfaces, and a synth that loaded them would load their ' +
        'dependencies too.',
      severity: 'error',
      from: { path: '^memorysmithapp-infra/(bin|config|stacks|constructs)/' },
      to: { path: '^memorysmithapp-infra/(commands|functional|agent-eval)/' },
    },
    {
      name: 'operations-reach-the-product-through-its-contracts',
      comment:
        'The commands, the functional suite and the agent evaluation reach the product the way ' +
        'anybody outside does, through its surfaces: of ' +
        'this repository they import @memorysmithapp/contracts and nothing else, not a service and ' +
        'not a stack.',
      severity: 'error',
      from: { path: '^memorysmithapp-infra/(commands|functional|agent-eval)/' },
      to: {
        path: '^memorysmithapp-(backend|frontend)/|^memorysmithapp-infra/(bin|config|stacks|constructs)/',
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
        'the interface (RN-AGT-022).',
      severity: 'error',
      from: { path: CONTRACTS },
      to: {
        path: '^memorysmithapp-(backend|frontend|infra)/',
        pathNot: CONTRACTS,
      },
    },
    {
      name: 'kernel-stays-primitive',
      comment:
        'The shared kernel is primitives with no rule of their own. It imports nothing of ours ' +
        'and no SDK; a large shared kernel is coupling in disguise.',
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
