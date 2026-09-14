/**
 * The instructions of the handshake (RN-AGT-028).
 *
 * They are the one text an MCP client places before the model without a tool
 * call, which makes them the only place that reaches an agent before it
 * chooses its first tool. The blind evaluation showed why that matters: an
 * agent that read the skill of its task wrote the notebook the method
 * describes, and agents that went from the list of notebooks straight to a
 * write never saw the index `whoami` carries. So the handshake sends the agent
 * to `whoami` and carries the index itself, in every environment.
 *
 * Nothing here is written beside what it describes: the index is the one
 * `whoami` prints, derived from the registry, and outside production the
 * environment notice comes first (RN-AGT-026).
 */

import type { Deployment } from '@memorysmith/contracts';
import { environmentNotice } from './environment.js';
import { skillIndex } from './skills.js';

export function serverInstructions(deployment: Deployment): string {
  const guide = [
    'MemorySmith hosts notebooks of Markdown notes that say how they want to be written:',
    'a guidance for the notebook, and a description and a template for each folder.',
    '',
    'Call `whoami` before any other tool. It says who you act as, which notebooks you',
    'reach, and the order in which a notebook is read before anything is written in it.',
    '',
    'Some tasks have a written method. Read its skill with `get_skill` BEFORE you start',
    'the task, not after it went wrong:',
    '',
    ...skillIndex(),
  ].join('\n');

  const notice = environmentNotice(deployment);
  return notice ? `${notice}\n\n${guide}` : guide;
}
