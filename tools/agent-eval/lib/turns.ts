/**
 * Whether the conversation is over, which the simulated user decides.
 *
 * Whether a message waits for the person is a reading of the message. The
 * round used to read it itself: a question mark, or a turn that wrote nothing
 * (#312). A turn that wrote and closed on an offer in the conditional, "Se
 * estiver bom, eu crio a versão 1", matched neither, and the round ended on an
 * agent that was waiting (#408). So every message goes to the simulated user
 * while the cap of the case allows another turn, and the simulated user, who
 * reads it as the person would, answers the marker when nothing is asked of
 * them. The marker ends the round and never reaches the executor.
 */

export const END_OF_CONVERSATION = '[DONE]';

/** Whether the reply of the simulated user ends the conversation. */
export function endsConversation(reply: string): boolean {
  return reply.includes(END_OF_CONVERSATION);
}
