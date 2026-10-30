/**
 * The shared kernel: primitives with no business rule of their own.
 * Deliberately tiny, because a large shared kernel is coupling in disguise.
 */

export { DomainError, ConcurrencyError, httpStatusFor, type ErrorCode } from './errors.js';
export { ok, err, isOk, isErr, mapOk, allOk, type Result, type Ok, type Err } from './result.js';
export { ulid, isUlid, canonicalUlid, ulidTime } from './ulid.js';
export { sha256Hex } from './hash.js';
export {
  SubscriptionId,
  NotebookId,
  FolderId,
  NoteId,
  FileId,
  TableId,
  DashboardId,
  ContentId,
  UserId,
} from './ids.js';
export { Slug, slugify } from './slug.js';
export {
  frontmatterBlock,
  bodyWithoutFrontmatter,
  parseFrontmatter,
  frontmatterOf,
  type Frontmatter,
  type FrontmatterEntry,
  type FrontmatterForm,
} from './frontmatter.js';
export { noteName, NAME_KEY } from './note-name.js';
export { codeRanges } from './markdown-code.js';
export {
  COMPARISONS,
  comparedFacets,
  normalize,
  parseQuery,
  QuerySyntaxError,
  STRUCTURAL_FIELDS,
  type Comparison,
  type QueryNode,
  type StructuralField,
} from './search-query.js';
export {
  isParameterName,
  parameterNames,
  parameterReferences,
  textReferences,
  type ParameterReference,
  type ReferencePlace,
} from './parameter-references.js';
export { Instant } from './instant.js';
export { Position, rebalancedPositions, REBALANCE_THRESHOLD } from './position.js';
export { Role, NotebookRoleLimit, type RoleName } from './role.js';
export { Authorship, AgentIdentity } from './authorship.js';
export { ContentRef, type ContentRole } from './content-ref.js';
export {
  createEvent,
  ACCESS_EVENT_TYPES,
  KNOWLEDGE_EVENT_TYPES,
  DISCOVERY_EVENT_TYPES,
  DOMAIN_EVENT_TYPES,
  type DomainEvent,
  type DomainEventType,
  type EventPublisher,
  type EventSubject,
} from './domain-event.js';
export {
  SubscriptionStatus,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatusName,
} from './subscription-status.js';
export { SubscriptionContext, type TokenClaims } from './subscription-context.js';
