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
