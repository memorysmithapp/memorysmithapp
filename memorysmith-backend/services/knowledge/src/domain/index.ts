/**
 * The Knowledge domain: aggregates, value objects, domain services and ports.
 * Zero imports of any AWS SDK, and the CI dependency rule is what keeps it
 * that way (architecture-guide.md, section 5.5).
 */

export { Notebook } from './notebook/Notebook.js';
export { Folder } from './notebook/Folder.js';
export { FolderTree } from './notebook/FolderTree.js';
export { Note } from './note/Note.js';
export { ContentSlot, type ContentSlotRole } from './content-slot/ContentSlot.js';
export { Guidance } from './content-slot/Guidance.js';
export { Template } from './content-slot/Template.js';
export {
  FolderDescription,
  FolderName,
  RemovalPolicy,
  ShortText,
  NotebookName,
  NOTEBOOK_LIMITS,
} from './values.js';
export { FolderTreePlacement, type Placement } from './services/FolderTreePlacement.js';
export { NotePlacement, type NoteOrder } from './services/NotePlacement.js';
export { NotebookFile } from './file/NotebookFile.js';
export type { FileTypes } from './ports/index.js';
export {
  composeNotebookContext,
  type NotebookContextInput,
} from './services/NotebookContextComposer.js';
export { admitWrite, type StorageBudget, type StorageState } from './services/StorageQuota.js';
export {
  AuthorizationPolicy,
  type Action,
  type RequestContext,
} from './access/AuthorizationPolicy.js';
export type {
  ContentSlotRepository,
  ContentStore,
  EventPublisher,
  FileRepository,
  FileStore,
  FolderNumbers,
  NoteRepository,
  NotebookRepository,
} from './ports/index.js';
