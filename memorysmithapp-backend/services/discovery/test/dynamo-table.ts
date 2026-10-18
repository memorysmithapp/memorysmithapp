/**
 * A DynamoDB table in memory, for the adapters of this service: it applies
 * what they write and answers what they read, by the commands of the document
 * client, and it counts both. It is not DynamoDB, and the adapter tests are
 * where the real one is asked; it is enough to hold an adapter to the items it
 * writes and to how many it reads.
 */

type Item = Record<string, unknown>;

interface Command {
  readonly constructor: { readonly name: string };
  readonly input: Record<string, unknown>;
}

/** Sort keys compare by code unit, which is byte order for what the tests write. */
const bySortKey = (left: Item, right: Item): number => {
  const a = String(left['SK']);
  const b = String(right['SK']);
  return a < b ? -1 : a > b ? 1 : 0;
};

export function dynamoTable() {
  const rows = new Map<string, Item>();
  const key = (item: { PK?: unknown; SK?: unknown }): string =>
    `${String(item.PK)}\u0000${String(item.SK)}`;
  const count = { read: 0, written: 0, commands: [] as string[], keys: [] as string[] };

  const put = (item: Item): void => {
    rows.set(key(item), item);
    count.written += 1;
    count.keys.push(String(item['SK']));
  };
  const drop = (target: Item): void => {
    rows.delete(key(target));
    count.written += 1;
    count.keys.push(`-${String(target['SK'])}`);
  };

  const db = {
    send: async (command: Command): Promise<Record<string, unknown>> => {
      const input = command.input;
      count.commands.push(command.constructor.name);
      switch (command.constructor.name) {
        case 'GetCommand': {
          const item = rows.get(key(input['Key'] as Item));
          if (item) count.read += 1;
          return { Item: item };
        }
        case 'PutCommand':
          put(input['Item'] as Item);
          return {};
        case 'DeleteCommand':
          drop(input['Key'] as Item);
          return {};
        case 'UpdateCommand':
          // The counters of the facet projection, which these tests do not read.
          count.written += 1;
          return {};
        case 'QueryCommand': {
          const values = input['ExpressionAttributeValues'] as Record<string, string>;
          const pk = values[':pk'];
          const prefix = values[':prefix'] ?? '';
          const limit = input['Limit'] as number | undefined;
          const found = [...rows.values()]
            .filter((item) => item['PK'] === pk && String(item['SK']).startsWith(prefix))
            .sort(bySortKey)
            .slice(0, limit ?? Number.POSITIVE_INFINITY);
          count.read += found.length;
          return { Items: found };
        }
        case 'BatchGetCommand': {
          const request = Object.entries(input['RequestItems'] as Record<string, { Keys: Item[] }>);
          const [table, { Keys }] = request[0] as [string, { Keys: Item[] }];
          const found = Keys.flatMap((each) => {
            const item = rows.get(key(each));
            return item ? [item] : [];
          });
          count.read += found.length;
          return { Responses: { [table]: found } };
        }
        case 'BatchWriteCommand': {
          const requests = Object.values(input['RequestItems'] as object)[0] as Array<
            Record<string, { Item?: Item; Key?: Item }>
          >;
          for (const request of requests) {
            if (request['PutRequest']?.Item) put(request['PutRequest'].Item);
            if (request['DeleteRequest']?.Key) drop(request['DeleteRequest'].Key);
          }
          return {};
        }
        case 'TransactWriteCommand': {
          for (const each of input['TransactItems'] as Array<Record<string, Item>>) {
            if (each['Put']) put(each['Put']['Item'] as Item);
            else if (each['Delete']) drop(each['Delete']['Key'] as Item);
            else count.written += 1;
          }
          return {};
        }
        default:
          throw new Error(`Unexpected command ${command.constructor.name}`);
      }
    },
  };

  /** Every sort key of one partition, in order. */
  const keysOf = (pk: string): string[] =>
    [...rows.values()]
      .filter((item) => item['PK'] === pk)
      .sort(bySortKey)
      .map((item) => String(item['SK']));

  /** What one call reads and writes, counted from nothing. */
  const measure = async (work: () => Promise<unknown>) => {
    count.read = 0;
    count.written = 0;
    count.commands = [];
    count.keys = [];
    await work();
    return {
      read: count.read,
      written: count.written,
      commands: [...count.commands],
      /** The sort keys written, a deleted one with a `-` before it. */
      keys: [...count.keys],
    };
  };

  /** An item written as an older release wrote it, past every adapter. */
  const seed = (item: Item): void => {
    rows.set(key(item), item);
  };

  return { db, rows, keysOf, measure, seed };
}
