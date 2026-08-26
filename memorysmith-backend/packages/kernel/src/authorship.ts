/**
 * Authorship: who wrote it, the human AND the agent that executed it.
 *
 * It is a mandatory argument of every aggregate operation that changes state
 * (PE6, RN-KNW-026): there is no anonymous mutation, because the method
 * signature makes one impossible. The inbound adapter fills it in - the MCP
 * tool adapter resolves the agent from the token, the UI adapter leaves it
 * null (architecture-guide.md, section 12.1).
 */

import { DomainError } from './errors.js';
import { type UserId } from './ids.js';
import { Instant } from './instant.js';
import { err, ok, type Result } from './result.js';

export class AgentIdentity {
  private readonly __agentIdentity!: void;
  private constructor(
    /** The CIMD client_id, which is a URL hosted by the client itself. */
    readonly clientId: string,
    readonly clientName: string,
  ) {}

  static create(clientId: string, clientName: string): Result<AgentIdentity, DomainError> {
    if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 512) {
      return err(DomainError.validation('An agent client_id must have 1 to 512 characters'));
    }
    const name = typeof clientName === 'string' && clientName.length > 0 ? clientName : clientId;
    return ok(new AgentIdentity(clientId, name.slice(0, 200)));
  }

  equals(other: unknown): boolean {
    return other instanceof AgentIdentity && other.clientId === this.clientId;
  }

  toJSON(): { clientId: string; clientName: string } {
    return { clientId: this.clientId, clientName: this.clientName };
  }
}

export class Authorship {
  private readonly __authorship!: void;
  private constructor(
    /** Always a human: the owner of the token, even when an agent typed it. */
    readonly user: UserId,
    /** null means the write came from the UI. */
    readonly agent: AgentIdentity | null,
    readonly at: Instant,
  ) {}

  static create(
    user: UserId,
    agent: AgentIdentity | null,
    at: Instant = Instant.now(),
  ): Authorship {
    return new Authorship(user, agent, at);
  }

  /** A write made through the web UI: a human, no agent. */
  static byHuman(user: UserId, at: Instant = Instant.now()): Authorship {
    return new Authorship(user, null, at);
  }

  /** A write made through the MCP connector, on behalf of the token owner. */
  static byAgent(user: UserId, agent: AgentIdentity, at: Instant = Instant.now()): Authorship {
    return new Authorship(user, agent, at);
  }

  get isAgentWrite(): boolean {
    return this.agent !== null;
  }

  toJSON(): {
    userId: string;
    agent: { clientId: string; clientName: string } | null;
    at: string;
  } {
    return {
      userId: this.user.value,
      agent: this.agent ? this.agent.toJSON() : null,
      at: this.at.toISOString(),
    };
  }
}
