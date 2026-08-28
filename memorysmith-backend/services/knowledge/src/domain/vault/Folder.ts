/**
 * Folder: an ordered node of the vault tree, part of the Vault aggregate.
 *
 * It is not a physical directory: nothing on disk or in S3 corresponds to it
 * (software-vision.md, section 3). Renaming, moving or reordering a folder
 * writes zero bytes of content, because the storage key encodes none of it.
 */

import type {
  Authorship,
  ContentRef,
  FolderId,
  Instant,
  Position,
  Slug,
} from '@memorysmith/kernel';
import type { FolderDescription, FolderName } from '../values.js';

export class Folder {
  private constructor(
    readonly id: FolderId,
    private _parentFolderId: FolderId | null,
    private _name: FolderName,
    private _slug: Slug,
    private _description: FolderDescription,
    private _position: Position,
    /** Opaque pointer to the Content Slot playing the template role. */
    private _templateRef: ContentRef | null,
    readonly createdBy: Authorship,
    private _updatedAt: Instant,
  ) {}

  static create(input: {
    id: FolderId;
    parentFolderId: FolderId | null;
    name: FolderName;
    slug: Slug;
    description: FolderDescription;
    position: Position;
    createdBy: Authorship;
  }): Folder {
    return new Folder(
      input.id,
      input.parentFolderId,
      input.name,
      input.slug,
      input.description,
      input.position,
      null,
      input.createdBy,
      input.createdBy.at,
    );
  }

  /** Rehydration from storage; the values were validated when written. */
  static rehydrate(input: {
    id: FolderId;
    parentFolderId: FolderId | null;
    name: FolderName;
    slug: Slug;
    description: FolderDescription;
    position: Position;
    templateRef: ContentRef | null;
    createdBy: Authorship;
    updatedAt: Instant;
  }): Folder {
    return new Folder(
      input.id,
      input.parentFolderId,
      input.name,
      input.slug,
      input.description,
      input.position,
      input.templateRef,
      input.createdBy,
      input.updatedAt,
    );
  }

  get parentFolderId(): FolderId | null {
    return this._parentFolderId;
  }
  get name(): FolderName {
    return this._name;
  }
  get slug(): Slug {
    return this._slug;
  }
  get description(): FolderDescription {
    return this._description;
  }
  get position(): Position {
    return this._position;
  }
  get templateRef(): ContentRef | null {
    return this._templateRef;
  }
  get hasTemplate(): boolean {
    return this._templateRef !== null;
  }
  get updatedAt(): Instant {
    return this._updatedAt;
  }
  get isRoot(): boolean {
    return this._parentFolderId === null;
  }

  /**
   * Mutations are package-private by convention: only the Vault aggregate
   * calls them, because only it can check the invariants they may break.
   */
  rename(name: FolderName, slug: Slug, at: Instant): void {
    this._name = name;
    this._slug = slug;
    this._updatedAt = at;
  }

  describe(description: FolderDescription, at: Instant): void {
    this._description = description;
    this._updatedAt = at;
  }

  moveTo(parentFolderId: FolderId | null, position: Position, at: Instant): void {
    this._parentFolderId = parentFolderId;
    this._position = position;
    this._updatedAt = at;
  }

  reorder(position: Position, at: Instant): void {
    this._position = position;
    this._updatedAt = at;
  }

  attachTemplate(ref: ContentRef, at: Instant): void {
    this._templateRef = ref;
    this._updatedAt = at;
  }
}
