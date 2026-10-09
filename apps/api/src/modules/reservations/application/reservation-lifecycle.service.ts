import { Injectable } from '@nestjs/common';
import {
  auditActions,
  cancelReservationSchema,
  createReservationSchema,
  reservationTransitionTarget,
  transitionReservationSchema,
  updateReservationSchema,
  type CancelReservationInput,
  type CreateReservationCommand,
  type ReservationStatus,
  type ReservationTransitionAction,
  type TransitionReservationInput,
  type UpdateReservationCommand,
  type UpdateReservationInput,
} from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import { AuditEventStore, type AuditWrite } from '../../../common/audit/audit-event.store';
import {
  ModuleDisabledError,
  ModuleEntitlementService,
} from '../../../common/authorization/module-entitlement';
import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { isReservationOverlap } from '../infrastructure/reservation-db-errors';
import {
  ReservationRepository,
  type ReservationOperations,
  type ReservationRecord,
  type ReservationUpdate,
} from '../infrastructure/reservation.repository';
import { canTransitionReservation } from '../domain/reservation-status-policy';
import { ReservationFailure } from './reservation-errors';
import { ReservationHistoryWriter } from './reservation-history';
import { assertBookable, reservationPeriod } from './reservation-rules';

const EDITABLE = new Set(['PENDING', 'CONFIRMED']);

@Injectable()
export class ReservationLifecycleService {
  constructor(
    private readonly reservations: ReservationRepository,
    private readonly history: ReservationHistoryWriter,
    private readonly audit: AuditEventStore,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async update(
    context: RequestContext,
    id: string,
    input: UpdateReservationInput,
  ): Promise<ReservationRecord> {
    await this.authorize(context);
    const patch = updateReservationSchema.parse(input);
    const scope = this.reservations.forTenant({ type: 'USER', context });
    try {
      return await scope.transaction(async (reservations, tx) => {
        await reservations.lock(id);
        const current = await requireReservation(reservations, id);
        if (!EDITABLE.has(current.status)) throw new ReservationFailure('RESERVATION_NOT_EDITABLE');
        const command = mergedCommand(current, patch);
        const period = reservationPeriod(command);
        await assertBookable(reservations, command, period, new Date());
        const updated = await reservations.update(id, updateData(command, period));
        if (updated === null) throw new ReservationFailure('RESERVATION_NOT_FOUND');
        await this.audit.append(tx, lifecycleAudit(context, id, auditActions.RESERVATION_UPDATED, null));
        return updated;
      });
    } catch (error) {
      if (isReservationOverlap(error)) throw new ReservationFailure('RESERVATION_TIME_CONFLICT');
      throw error;
    }
  }

  async cancel(
    context: RequestContext,
    id: string,
    input: CancelReservationInput,
  ): Promise<ReservationRecord> {
    await this.authorize(context);
    const body = cancelReservationSchema.parse(input);
    const scope = this.reservations.forTenant({ type: 'USER', context });
    return scope.transaction(async (reservations, tx) => {
      await reservations.lock(id);
      const current = await requireReservation(reservations, id);
      if (current.status === 'CANCELLED') return current;
      if (!canTransitionReservation(current.status, 'CANCELLED')) {
        throw new ReservationFailure('RESERVATION_NOT_EDITABLE');
      }
      const updated = await reservations.update(id, { status: 'CANCELLED', cancelledAt: new Date() });
      if (updated === null) throw new ReservationFailure('RESERVATION_NOT_FOUND');
      await this.history.appendTransition(tx, {
        tenantId: context.tenantId,
        reservationId: id,
        changedByUserId: context.userId,
        fromStatus: current.status,
        toStatus: 'CANCELLED',
        reason: body.reason ?? null,
      });
      await this.audit.append(
        tx,
        lifecycleAudit(context, id, auditActions.RESERVATION_STATUS_CHANGED, body.reason ?? null),
      );
      return updated;
    });
  }

  /**
   * Moves one booking through confirm, arrive, seat, complete, or no-show.
   * The same status again is a no-op. A skipped or backward step is rejected.
   */
  async transition(
    context: RequestContext,
    id: string,
    action: ReservationTransitionAction,
    input: TransitionReservationInput,
  ): Promise<ReservationRecord> {
    await this.authorize(context);
    const body = transitionReservationSchema.parse(input);
    const next = reservationTransitionTarget(action);
    const scope = this.reservations.forTenant({ type: 'USER', context });
    return scope.transaction(async (reservations, tx) => {
      await reservations.lock(id);
      const current = await requireReservation(reservations, id);
      if (current.status === next) return current;
      if (!canTransitionReservation(current.status, next)) {
        throw new ReservationFailure('RESERVATION_INVALID_TRANSITION');
      }
      const updated = await reservations.update(id, statusStamp(next));
      if (updated === null) throw new ReservationFailure('RESERVATION_NOT_FOUND');
      await this.history.appendTransition(tx, {
        tenantId: context.tenantId,
        reservationId: id,
        changedByUserId: context.userId,
        fromStatus: current.status,
        toStatus: next,
        reason: body.reason ?? null,
      });
      await this.audit.append(
        tx,
        lifecycleAudit(context, id, auditActions.RESERVATION_STATUS_CHANGED, body.reason ?? null),
      );
      return updated;
    });
  }

  private async authorize(context: RequestContext): Promise<void> {
    try {
      await this.entitlements.requireEnabled(scopedTenantId(context), 'reservations');
    } catch (error) {
      if (error instanceof ModuleDisabledError) throw new ReservationFailure('RESERVATION_MODULE_DISABLED');
      throw error;
    }
    requirePermission(context, 'reservations:update');
  }
}

async function requireReservation(
  reservations: ReservationOperations,
  id: string,
): Promise<ReservationRecord> {
  const reservation = await reservations.findById(id);
  if (reservation === null) throw new ReservationFailure('RESERVATION_NOT_FOUND');
  return reservation;
}

function mergedCommand(
  current: ReservationRecord,
  patch: UpdateReservationCommand,
): CreateReservationCommand {
  const startsAt = patch.startsAt ?? current.startsAt.toISOString();
  const currentDuration = Math.round((current.endsAt.getTime() - current.startsAt.getTime()) / 60_000);
  return createReservationSchema.parse({
    locationId: patch.locationId ?? current.locationId,
    startsAt,
    durationMinutes: patch.durationMinutes ?? currentDuration,
    guestCount: patch.guestCount ?? current.guestCount,
    requestedTableId: patch.requestedTableId ?? current.tableId ?? '',
    ...(patch.assignedUserId === undefined
      ? current.assignedUserId === null ? {} : { assignedUserId: current.assignedUserId }
      : patch.assignedUserId === null ? {} : { assignedUserId: patch.assignedUserId }),
    customer: {
      name: patch.customerName ?? current.customerName,
      ...(patch.customerPhone === undefined
        ? current.customerPhone === null ? {} : { phone: current.customerPhone }
        : patch.customerPhone === null ? {} : { phone: patch.customerPhone }),
      ...(patch.customerEmail === undefined
        ? current.customerEmail === null ? {} : { email: current.customerEmail }
        : patch.customerEmail === null ? {} : { email: patch.customerEmail }),
      ...(patch.contactId === undefined
        ? current.contactId === null ? {} : { contactId: current.contactId }
        : patch.contactId === null ? {} : { contactId: patch.contactId }),
    },
    ...(patch.customerNote === undefined
      ? current.customerNote === null ? {} : { customerNote: current.customerNote }
      : patch.customerNote === null ? {} : { customerNote: patch.customerNote }),
    source: {
      type: current.source,
      ...(current.sourceAccountId === null ? {} : { accountId: current.sourceAccountId }),
      ...(current.sourceRequestId === null ? {} : { externalRequestId: current.sourceRequestId }),
      ...(current.sourceConversationId === null ? {} : { conversationId: current.sourceConversationId }),
      ...(current.sourceMessageId === null ? {} : { messageId: current.sourceMessageId }),
    },
  });
}

function statusStamp(next: ReservationStatus): ReservationUpdate {
  const now = new Date();
  if (next === 'CONFIRMED') return { status: next, confirmedAt: now };
  if (next === 'ARRIVED') return { status: next, arrivedAt: now };
  if (next === 'SEATED') return { status: next, seatedAt: now };
  if (next === 'COMPLETED') return { status: next, completedAt: now };
  return { status: next };
}

function updateData(
  command: CreateReservationCommand,
  period: { startsAt: Date; endsAt: Date },
): ReservationUpdate {
  return {
    locationId: command.locationId,
    tableId: command.requestedTableId,
    contactId: command.customer.contactId ?? null,
    assignedUserId: command.assignedUserId ?? null,
    guestCount: command.guestCount,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    customerName: command.customer.name,
    customerPhone: command.customer.phone ?? null,
    customerEmail: command.customer.email ?? null,
    customerNote: command.customerNote ?? null,
  };
}

function lifecycleAudit(
  context: RequestContext,
  reservationId: string,
  action: typeof auditActions.RESERVATION_UPDATED | typeof auditActions.RESERVATION_STATUS_CHANGED,
  reason: string | null,
): AuditWrite {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorRole: context.role,
    actorType: 'USER',
    action,
    resourceType: 'reservation',
    resourceId: reservationId,
    outcome: 'SUCCESS',
    changes: null,
    reason,
    requestId: context.requestId,
    ipHash: null,
    userAgent: null,
  };
}
