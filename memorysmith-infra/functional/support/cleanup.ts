/**
 * What a run wrote, deleted the way a person deletes it (#276,
 * architecture-guide.md, section 19).
 *
 * Every notebook an account of the run owns is deleted through the API, as
 * that account, before the account itself is: the purge then takes the
 * content, the items and the projections as it does for anybody, and the
 * suite stays one more caller of the product rather than a second way to
 * delete. It is cleanup, not a case, so it never throws: what it could not
 * delete it names, and the run goes on to delete the accounts.
 */

import { Api } from './api.js';
import { apiToken } from './accounts.js';
import type { RunState, TestAccount } from './state.js';

export interface Cleanup {
  readonly deleted: number;
  readonly failed: readonly string[];
}

export async function deleteNotebooksOf(
  state: Pick<RunState, 'region' | 'userPoolId' | 'webClientId' | 'surfaces'>,
  account: Pick<TestAccount, 'email' | 'password'>,
): Promise<Cleanup> {
  const failed: string[] = [];
  let deleted = 0;
  try {
    const api = new Api(state.surfaces.api, await apiToken(state, account, true));
    const listed = await api.call<Array<{ notebookId: string }>>('GET', '/knowledge/notebooks');
    // An account with no subscription, or one never made active, has nothing here.
    if (listed.status !== 200 || !Array.isArray(listed.body)) return { deleted, failed };
    for (const { notebookId } of listed.body) {
      const answer = await api.call('DELETE', `/knowledge/notebooks/${notebookId}`);
      // A case may have deleted it already, and that is what was wanted.
      if (answer.status === 204 || answer.status === 404) deleted += 1;
      else failed.push(`${account.email} ${notebookId}: ${answer.status}`);
    }
  } catch (error) {
    failed.push(`${account.email}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { deleted, failed };
}
