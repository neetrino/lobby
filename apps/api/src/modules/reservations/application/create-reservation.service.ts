import { Injectable } from '@nestjs/common';
import {
  createReservationSchema,
  type CreateReservationCommand,
  type CreateReservationInput,
} from '@lobby/contracts';
import { z } from 'zod';

import { scopedTenantId } from '../../../common/auth/authorization';
import { AuditEventStore, type AuditWrite } from '../../../common/audit/audit-event.store';
import {
  ModuleDisabledError,
  ModuleEntitlementService,
} from '../../../common/authorization/module-entitlement';
import { requirePermission } from '../../../common/authorization/require-permission';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import {
  isReservationOverlap,
  isSourceRequestConflict,
} from '../infrastructure/reservation-db-errors';
import {
  ReservationRepository,
  type ReservationInsert,
  type ReservationRecord,
  type SourceIdentity,
  type TenantReservations,
} from '../infrastructure/reservation.repository';
import type { ReservationActor } from './reservation-actor';
import { reservationCreatedEvent } from './reservation-events';
import { ReservationFailure } from './reservation-errors';
import { ReservationHistoryWriter } from './reservation-history';
import {
  assertActorSource,
  assertBookable,
  reservationPeriod,
  sameBooking,
  type ReservationPeriod,
} from './reservation-rules';

export type CreateReservationResult = {
  reservation: ReservationRecord;
  replayed: boolean;
};

@Injectable()
export class CreateReservationService {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly history: ReservationHistoryWriter,
    private readonly audit: AuditEventStore,
    private readonly outbox: OutboxService,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async create(actor: ReservationActor, input: CreateReservationInput): Promise<CreateReservationResult> {
    await this.gate(actor);
    const command = createReservationSchema.parse(input);
    assertActorSource(actor, command);
    const scope = this.reservations.forTenant(actor);
    const period = reservationPeriod(command);
    await assertBookable(scope, command, period, new Date());
    const replay = await this.replayExisting(scope, command, period);
    if (replay !== null) {
      return replay;
    }
    try {
      return await this.commit(actor, scope, command, period);
    } catch (error) {
      return this.recover(scope, command, period, error);
    }
  }

  private async gate(actor: ReservationActor): Promise<void> {
    const tenantId = actor.type === 'USER' ? scopedTenantId(actor.context) : scopedTenantId(actor);
    try {
      await this.entitlements.requireEnabled(tenantId, 'reservations');
    } catch (error) {
      if (error instanceof ModuleDisabledError) {
        throw new ReservationFailure('RESERVATION_MODULE_DISABLED');
      }
      throw error;
    }
    if (actor.type === 'USER') {
      requirePermission(actor.context, 'reservations:create');
    }
  }

  private async replayExisting(
    scope: TenantReservations,
    command: CreateReservationCommand,
    period: ReservationPeriod,
  ): Promise<CreateReservationResult | null> {
    const source = sourceIdentity(command);
    if (source === null) {
      return null;
    }
    const existing = await scope.findBySourceRequest(source);
    return existing === null ? null : replay(existing, command, period);
  }

  private async commit(
    actor: ReservationActor,
    scope: TenantReservations,
    command: CreateReservationCommand,
    period: ReservationPeriod,
  ): Promise<CreateReservationResult> {
    const tenantId = actor.type === 'USER' ? actor.context.tenantId : actor.tenantId;
    const source = sourceIdentity(command);
    const reservation = await scope.transaction(async (writes, tx) => {
      const created = await writes.insertReservation(reservationInsert(actor, command, period));
      await this.history.appendInitial(tx, {
        tenantId,
        reservationId: created.id,
        changedByUserId: actor.type === 'USER' ? actor.context.userId : null,
      });
      if (source !== null) {
        await writes.insertSourceRequest(source, created.id);
      }
      if (actor.type === 'USER') {
        await this.audit.append(tx, createdAudit(actor.context, created.id));
      }
      await this.outbox.enqueue(tx, reservationCreatedEvent(eventInput(tenantId, created, command)));
      return created;
    });
    return { reservation, replayed: false };
  }

  private async recover(
    scope: TenantReservations,
    command: CreateReservationCommand,
    period: ReservationPeriod,
    error: unknown,
  ): Promise<CreateReservationResult> {
    const source = sourceIdentity(command);
    const duplicate = isReservationOverlap(error) || isSourceRequestConflict(error);
    if (source !== null && duplicate) {
      const existing = await scope.findBySourceRequest(source);
      if (existing !== null) {
        return replay(existing, command, period);
      }
    }
    if (isReservationOverlap(error)) {
      throw new ReservationFailure('RESERVATION_TIME_CONFLICT');
    }
    throw error;
  }
}

function replay(
  existing: ReservationRecord,
  command: CreateReservationCommand,
  period: ReservationPeriod,
): CreateReservationResult {
  if (!sameBooking(existing, command, period)) {
    throw new ReservationFailure('RESERVATION_SOURCE_CONFLICT');
  }
  return { reservation: existing, replayed: true };
}

function sourceIdentity(command: CreateReservationCommand): SourceIdentity | null {
  const accountId = command.source.accountId;
  const externalRequestId = command.source.externalRequestId;
  if (accountId === undefined || externalRequestId === undefined) {
    return null;
  }
  return { source: command.source.type, sourceAccountId: accountId, externalRequestId };
}

function reservationInsert(
  actor: ReservationActor,
  command: CreateReservationCommand,
  period: ReservationPeriod,
): ReservationInsert {
  return {
    locationId: command.locationId,
    tableId: command.requestedTableId,
    contactId: command.customer.contactId ?? null,
    assignedUserId: command.assignedUserId ?? null,
    createdByUserId: actor.type === 'USER' ? actor.context.userId : null,
    source: command.source.type,
    guestCount: command.guestCount,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    customerName: command.customer.name,
    customerPhone: command.customer.phone ?? null,
    customerEmail: command.customer.email ?? null,
    customerNote: command.customerNote ?? null,
    sourceAccountId: uuidOrNull(command.source.accountId),
    sourceRequestId: command.source.externalRequestId ?? null,
    sourceConversationId: command.source.conversationId ?? null,
    sourceMessageId: command.source.messageId ?? null,
  };
}

function eventInput(tenantId: string, reservation: ReservationRecord, command: CreateReservationCommand) {
  return {
    tenantId,
    reservationId: reservation.id,
    locationId: reservation.locationId,
    contactId: reservation.contactId,
    source: command.source.type,
    startsAt: reservation.startsAt,
  };
}

function createdAudit(context: RequestContext, reservationId: string): AuditWrite {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorRole: context.role,
    actorType: 'USER',
    action: 'reservation.created',
    resourceType: 'reservation',
    resourceId: reservationId,
    outcome: 'SUCCESS',
    changes: null,
    reason: null,
    requestId: context.requestId,
    ipHash: null,
    userAgent: null,
  };
}

function uuidOrNull(value: string | undefined): string | null {
  if (value === undefined || !z.uuid().safeParse(value).success) {
    return null;
  }
  return value;
}
