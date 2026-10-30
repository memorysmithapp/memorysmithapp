/**
 * A Dashboard of a notebook (#368): a name, what it is for, and a definition
 * an agent wrote — a layout, filters and components drawn from its Tables.
 *
 * It keeps no data. Every component asks its table when the dashboard is read,
 * so what a dashboard shows is what its tables hold at that moment. It is an
 * Aggregate Root of its own, as a Table is: nothing about it is an invariant of
 * the tree, and the definition is replaced whole every time it changes.
 */

import {
  type Authorship,
  createEvent,
  type DashboardId,
  DomainError,
  type DomainEvent,
  err,
  type NotebookId,
  ok,
  type Result,
  type SubscriptionId,
} from '@memorysmithapp/kernel';
import { DASHBOARD_LIMITS, type Definition } from './DashboardDefinition.js';

const UNADDRESSABLE = /[#[\]|\n\r`]/;

export function checkDashboardName(raw: string): Result<string, DomainError> {
  const name = raw.normalize('NFC').trim();
  if (name.length === 0) return err(DomainError.validation('A dashboard needs a name'));
  if (name.length > DASHBOARD_LIMITS.nameLength) {
    return err(
      DomainError.validation(
        `A dashboard name goes up to ${DASHBOARD_LIMITS.nameLength} characters`,
      ),
    );
  }
  if (UNADDRESSABLE.test(name)) {
    return err(
      DomainError.validation('A dashboard name holds no #, [, ], |, backtick or line break'),
    );
  }
  return ok(name);
}

export class Dashboard {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: DashboardId,
    readonly subscriptionId: SubscriptionId,
    readonly notebookId: NotebookId,
    private _name: string,
    private _description: string,
    private _definition: Definition,
    readonly createdBy: Authorship,
    private _updatedBy: Authorship,
    private _deleted: boolean,
    private readonly _version: number,
  ) {}

  static create(input: {
    id: DashboardId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    definition: Definition;
    by: Authorship;
  }): Result<Dashboard, DomainError> {
    const name = checkDashboardName(input.name);
    if (!name.ok) return name;
    const description = input.description.trim();
    if (description.length > DASHBOARD_LIMITS.descriptionLength) {
      return err(
        DomainError.validation(
          `A description goes up to ${DASHBOARD_LIMITS.descriptionLength} characters`,
        ),
      );
    }
    const dashboard = new Dashboard(
      input.id,
      input.subscriptionId,
      input.notebookId,
      name.value,
      description,
      input.definition,
      input.by,
      input.by,
      false,
      0,
    );
    dashboard.record('DashboardCreated', input.by);
    return ok(dashboard);
  }

  static rehydrate(input: {
    id: DashboardId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    definition: Definition;
    createdBy: Authorship;
    updatedBy: Authorship;
    version: number;
  }): Dashboard {
    return new Dashboard(
      input.id,
      input.subscriptionId,
      input.notebookId,
      input.name,
      input.description,
      input.definition,
      input.createdBy,
      input.updatedBy,
      false,
      input.version,
    );
  }

  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get definition(): Definition {
    return this._definition;
  }
  get updatedBy(): Authorship {
    return this._updatedBy;
  }
  get version(): number {
    return this._version;
  }
  get isDeleted(): boolean {
    return this._deleted;
  }

  /** Replaces what it is called, says and draws, whole: a definition is never patched. */
  change(input: {
    name: string;
    description: string;
    definition: Definition;
    by: Authorship;
  }): Result<void, DomainError> {
    const name = checkDashboardName(input.name);
    if (!name.ok) return name;
    const description = input.description.trim();
    if (description.length > DASHBOARD_LIMITS.descriptionLength) {
      return err(
        DomainError.validation(
          `A description goes up to ${DASHBOARD_LIMITS.descriptionLength} characters`,
        ),
      );
    }
    this._name = name.value;
    this._description = description;
    this._definition = input.definition;
    this._updatedBy = input.by;
    this.record('DashboardChanged', input.by);
    return ok(undefined);
  }

  /** Deleting is definitive (INV-08); a dashboard holds no data, so nothing is left to purge. */
  delete(by: Authorship): Result<void, DomainError> {
    if (this._deleted) return err(DomainError.notFound('Dashboard not found'));
    this._deleted = true;
    this._updatedBy = by;
    this.record('DashboardDeleted', by);
    return ok(undefined);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  nextVersion(): number {
    return this._version + 1;
  }

  private record(
    type: 'DashboardCreated' | 'DashboardChanged' | 'DashboardDeleted',
    by: Authorship,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: 'DASHBOARD',
        subjectId: this.id.value,
        authorship: by,
        payload: {
          notebookId: this.notebookId.value,
          dashboardId: this.id.value,
          name: this._name,
        },
      }),
    );
  }
}
