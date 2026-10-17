/**
 * Entrypoint of the link reprojection (#102, #311): the three steps of the
 * state machine that rebuilds the link graph of an environment.
 *
 * It used to be a process on somebody's computer, which held that computer for
 * the whole run, worked one notebook after the other and said nothing until
 * the end. The graph of a notebook is rebuilt from that notebook alone, so the
 * run splits by notebook and belongs to AWS: `list` names the live notebooks,
 * the map calls `notebook` once for each, a few dozen at once, and `summarise`
 * sums what they answered. Start it with
 * `pnpm -C memorysmithapp-infra reproject-links`, after a deploy that changed
 * the rule a link is resolved by, or whenever the graph is found wrong.
 *
 * A projection that disagrees with the rule links are resolved by is rebuilt
 * rather than repaired: an edge exists because the current rule says so, and
 * not because an old projection said so. What the rebuild does, and why the
 * check after it is "no edge is lost" rather than "the same edges", is in
 * `services/discovery/src/adapters/reprojection.ts`.
 *
 * A run is started in a mode: `report` plans and writes nothing, `apply`
 * rebuilds, because a job that silently replaces a graph nobody looked at is
 * how a wrong graph becomes the new truth.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { SubscriptionId } from '@memorysmithapp/kernel';
import { DynamoLinkGraph } from '@memorysmithapp/svc-discovery/adapters/aws';
import {
  LinkReprojection,
  outcomeOf,
  summarise,
  type NotebookAddress,
  type NotebookResult,
  type RunSummary,
} from '@memorysmithapp/svc-discovery/adapters/reprojection';
import { observe } from '@memorysmithapp/observability';

type Mode = 'report' | 'apply';

export type ReprojectionStep =
  | { readonly step: 'list'; readonly mode: Mode; readonly run?: string }
  | ({ readonly step: 'notebook'; readonly mode: Mode; readonly run?: string } & NotebookAddress)
  | {
      readonly step: 'summarise';
      readonly mode: Mode;
      readonly run?: string;
      readonly results: readonly NotebookResult[];
    };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const discoveryTable = required('DISCOVERY_TABLE');
const bucket = required('CONTENT_BUCKET');

const reprojection = new LinkReprojection({
  db,
  knowledgeTable: required('KNOWLEDGE_TABLE'),
  graphFor: (subscriptionId: SubscriptionId) =>
    new DynamoLinkGraph(subscriptionId, db, discoveryTable),
  contentFor: (subscriptionId: SubscriptionId) => ({
    read: async (ref) => {
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `s/${subscriptionId.value}/c/${ref.contentId}.md`,
          VersionId: ref.versionId,
        }),
      );
      return (await response.Body?.transformToString('utf-8')) ?? '';
    },
  }),
});

/** A mode the run was not started in is refused before anything is read. */
function modeOf(event: { mode?: unknown }): Mode {
  if (event.mode === 'report' || event.mode === 'apply') return event.mode;
  throw new Error(`A reprojection runs as "report" or "apply", never as ${String(event.mode)}.`);
}

export async function handler(
  event: ReprojectionStep,
): Promise<{ notebooks: NotebookAddress[] } | NotebookResult | RunSummary> {
  const mode = modeOf(event);
  // Every line of a run carries the name of its execution, which is what
  // finds a notebook of the summary in the logs (section 17).
  const correlationId = event.run;

  if (event.step === 'list') {
    return observe({ operation: 'reproject list', correlationId }, async () => ({
      notebooks: await reprojection.notebooks(),
    }));
  }

  if (event.step === 'notebook') {
    const address = { subscriptionId: event.subscriptionId, notebookId: event.notebookId };
    return observe(
      {
        operation: `reproject ${mode}`,
        correlationId,
        subscriptionId: address.subscriptionId,
      },
      async (): Promise<NotebookResult> => {
        const plan = await reprojection.planNotebook(address);
        if (!plan) return { ...address, gone: true };
        if (mode === 'apply') await reprojection.apply(plan);
        return outcomeOf(plan);
      },
    );
  }

  if (event.step === 'summarise') {
    return observe({ operation: 'reproject summarise', correlationId }, async () =>
      summarise(mode, event.results),
    );
  }

  throw new Error(`There is no step called ${String((event as { step?: unknown }).step)}.`);
}
