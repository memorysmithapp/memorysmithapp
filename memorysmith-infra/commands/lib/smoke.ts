/**
 * What a deploy has to prove before it is called done (architecture-guide.md, 20).
 *
 * Every surface answering is not enough: the site answered 200 with the old
 * bundle after the 0.5.7 deploy, and the only proof that the new one was served
 * was reading the minified JavaScript by hand. So the smoke asks each surface
 * which version it serves, reads nothing it would have to sign in for, and
 * writes nothing.
 */

export interface Expected {
  readonly environment: string;
  readonly version: string;
}

/** What the three surfaces answered, as the smoke collected it. */
export interface SurfaceAnswers {
  /** `GET <api>/health`. */
  readonly api: {
    readonly status: number;
    readonly body: unknown;
    readonly version: string | null;
  };
  /** `GET <site>/config.json`. */
  readonly site: { readonly status: number; readonly body: unknown };
  /** `POST <mcp>/mcp` without a token, which must be the OAuth challenge. */
  readonly mcp: {
    readonly status: number;
    readonly challenge: string | null;
    readonly version: string | null;
  };
}

function field(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

/** Every way the surfaces disagree with the deploy, as sentences, or none. */
export function smokeProblems(expected: Expected, answers: SurfaceAnswers): string[] {
  const problems: string[] = [];
  const claims = (surface: string, what: string, actual: unknown, wanted: string): void => {
    if (actual !== wanted) {
      problems.push(
        `${surface} serves ${what} ${String(actual ?? 'nothing')}, and this deploy is ${wanted}.`,
      );
    }
  };

  if (answers.api.status !== 200) {
    problems.push(`The API answered ${answers.api.status} at /health.`);
  } else {
    claims('The API', 'the version', field(answers.api.body, 'version'), expected.version);
    claims(
      'The API',
      'the environment',
      field(answers.api.body, 'environment'),
      expected.environment,
    );
  }
  claims('The API', 'in its headers the version', answers.api.version, expected.version);

  if (answers.site.status !== 200) {
    problems.push(`The site answered ${answers.site.status} at /config.json.`);
  } else {
    claims('The site', 'the version', field(answers.site.body, 'version'), expected.version);
    claims(
      'The site',
      'the environment',
      field(answers.site.body, 'environment'),
      expected.environment,
    );
  }

  if (answers.mcp.status !== 401 || !answers.mcp.challenge?.includes('resource_metadata')) {
    // Without the challenge an agent client never finds the authorization
    // server, and gives up before it asks anybody to sign in.
    problems.push(
      `The MCP endpoint answered ${answers.mcp.status} without the resource_metadata challenge.`,
    );
  }
  claims('The MCP endpoint', 'in its headers the version', answers.mcp.version, expected.version);

  return problems;
}
