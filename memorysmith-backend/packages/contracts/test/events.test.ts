import { describe, expect, it } from 'vitest';
import { parseEvent, eventEnvelopeSchema } from '../src/events.js';
import { vaultDetailSchema } from '../src/api/knowledge.js';
import { sessionSchema } from '../src/api/access.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const VAULT = '01JBQ2X0000000000000000001';
const NOTE = '01JBQ2X0000000000000000002';
const FOLDER = '01JBQ2X0000000000000000003';
const CONTENT = '01JBQ2X0000000000000000004';
const EVENT = '01JBQ2X0000000000000000005';
const WORKSPACE = '01JBQ2X0000000000000000006';

const authorship = {
  userId: 'user-1',
  agent: { clientId: 'https://claude.ai/mcp', clientName: 'Claude' },
  at: '2026-03-12T10:15:00.000Z',
};

const noteCreated = {
  eventId: EVENT,
  type: 'NoteCreated' as const,
  occurredAt: '2026-03-12T10:15:00.000Z',
  subscriptionId: SUBSCRIPTION,
  subject: 'NOTE' as const,
  subjectId: NOTE,
  authorship,
  contentRef: {
    contentId: CONTENT,
    versionId: 'sBcD3',
    sha256: 'b'.repeat(64),
    bytes: 512,
  },
  payload: {
    vaultId: VAULT,
    noteId: NOTE,
    folderId: FOLDER,
    title: 'Lei 14.133, art. 75',
    slug: 'lei-14133-art-75',
    position: 'a0',
  },
};

describe('event contracts', () => {
  it('accepts a well-formed content event with its complete ContentRef', () => {
    const parsed = parseEvent(noteCreated);
    expect(parsed.type).toBe('NoteCreated');
    expect(parsed.contentRef?.sha256).toHaveLength(64);
  });

  it('rejects a content event whose ContentRef carries only the versionId', () => {
    // Without the full ref the audit trail records "the note changed" without
    // being able to show what it changed to (architecture-guide.md, 9.2).
    const truncated = { ...noteCreated, contentRef: { versionId: 'sBcD3' } };
    expect(() => parseEvent(truncated)).toThrow();
  });

  it('rejects a payload that does not match its own event type', () => {
    const mismatched = { ...noteCreated, payload: { vaultId: VAULT } };
    expect(() => parseEvent(mismatched)).toThrow();
  });

  it('rejects an envelope with no subscription', () => {
    const { subscriptionId: _dropped, ...withoutSubscription } = noteCreated;
    expect(() => eventEnvelopeSchema.parse(withoutSubscription)).toThrow();
  });

  it('accepts a UI write, which carries no agent', () => {
    const fromUi = {
      ...noteCreated,
      authorship: { ...authorship, agent: null },
    };
    expect(parseEvent(fromUi).authorship.agent).toBeNull();
  });

  it('accepts a cross-vault move carrying both sides', () => {
    const moved = {
      ...noteCreated,
      type: 'NoteMoved' as const,
      contentRef: null,
      payload: {
        noteId: NOTE,
        fromVaultId: VAULT,
        fromFolderId: FOLDER,
        toVaultId: '01JBQ2X0000000000000000007',
        toFolderId: '01JBQ2X0000000000000000008',
        slug: 'lei-14133-art-75',
        position: 'a1',
      },
    };
    expect(parseEvent(moved).type).toBe('NoteMoved');
  });
});

describe('API DTOs', () => {
  it('describes a vault with its annotated tree', () => {
    const detail = vaultDetailSchema.parse({
      vaultId: VAULT,
      workspaceId: WORKSPACE,
      name: 'Normas e Legislacao',
      slug: 'normas-e-legislacao',
      description: 'Texto normativo por artigo',
      noteCount: 48,
      hasGuidance: true,
      updatedAt: '2026-03-12T10:15:00.000Z',
      effectiveRole: 'EDITOR',
      folders: [
        {
          folderId: FOLDER,
          parentFolderId: null,
          name: 'Normas',
          slug: 'normas',
          description: 'Texto normativo por artigo. Uma norma por nota.',
          position: 'a0',
          hasTemplate: true,
          noteCount: 48,
        },
      ],
      guidance: null,
    });
    expect(detail.folders[0]?.hasTemplate).toBe(true);
  });

  it('refuses a folder with an empty description', () => {
    // The description is what steers where the agent writes (RN-KNW-006).
    expect(() =>
      vaultDetailSchema.parse({
        vaultId: VAULT,
        workspaceId: WORKSPACE,
        name: 'V',
        slug: 'v',
        description: '',
        noteCount: 0,
        hasGuidance: false,
        updatedAt: '2026-03-12T10:15:00.000Z',
        effectiveRole: 'VIEWER',
        folders: [
          {
            folderId: FOLDER,
            parentFolderId: null,
            name: 'Sem descricao',
            slug: 'sem-descricao',
            description: '',
            position: 'a0',
            hasTemplate: false,
            noteCount: 0,
          },
        ],
        guidance: null,
      }),
    ).toThrow();
  });

  it('describes a session with no active subscription yet', () => {
    const session = sessionSchema.parse({
      user: {
        userId: 'user-1',
        email: 'owner@example.com',
        name: 'Owner',
        isPlatformAdmin: false,
      },
      activeSubscription: null,
      subscriptions: [],
      // No subscription means no role in one: NONE is the honest answer, and
      // the schema requires it rather than letting it be forgotten.
      role: 'NONE',
      // No subscription also means nothing stored under one, and null says
      // that, where a zero would claim an empty subscription exists.
      usedBytes: null,
    });
    expect(session.activeSubscription).toBeNull();
    expect(session.role).toBe('NONE');
    expect(session.usedBytes).toBeNull();
  });
});
