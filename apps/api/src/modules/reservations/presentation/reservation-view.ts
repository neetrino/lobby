import type { ReservationRecord } from '../infrastructure/reservation.repository';

export type ReservationView = {
  id: string;
  status: string;
  locationId: string;
  tableId: string | null;
  guestCount: number;
  startsAt: string;
  endsAt: string;
  customerName: string;
};

export type ReservationDetailView = ReservationView & {
  contactId: string | null;
  assignedUserId: string | null;
  source: string;
  durationMinutes: number;
  customerPhone: string | null;
  customerEmail: string | null;
  customerNote: string | null;
  confirmedAt: string | null;
  arrivedAt: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Public booking body. Phone, email, and notes stay out. */
export function toReservationView(reservation: ReservationRecord): ReservationView {
  return {
    id: reservation.id,
    status: reservation.status,
    locationId: reservation.locationId,
    tableId: reservation.tableId,
    guestCount: reservation.guestCount,
    startsAt: reservation.startsAt.toISOString(),
    endsAt: reservation.endsAt.toISOString(),
    customerName: reservation.customerName,
  };
}

export function toReservationDetailView(reservation: ReservationRecord): ReservationDetailView {
  return {
    ...toReservationView(reservation),
    contactId: reservation.contactId,
    assignedUserId: reservation.assignedUserId,
    source: reservation.source,
    durationMinutes: Math.round((reservation.endsAt.getTime() - reservation.startsAt.getTime()) / 60_000),
    customerPhone: reservation.customerPhone,
    customerEmail: reservation.customerEmail,
    customerNote: reservation.customerNote,
    confirmedAt: isoOrNull(reservation.confirmedAt),
    arrivedAt: isoOrNull(reservation.arrivedAt),
    seatedAt: isoOrNull(reservation.seatedAt),
    completedAt: isoOrNull(reservation.completedAt),
    cancelledAt: isoOrNull(reservation.cancelledAt),
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
  };
}

function isoOrNull(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}
