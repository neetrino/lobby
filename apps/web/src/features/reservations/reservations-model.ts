import type { SessionPrincipal } from '../contacts/contact';

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const STAFF_SOURCES = ['STAFF', 'PHONE', 'WALK_IN'] as const;

export type StaffSource = (typeof STAFF_SOURCES)[number];

export type ReservationTransitionAction = 'confirm' | 'arrive' | 'seat' | 'complete' | 'no-show';

export type ReservationSummary = {
  id: string;
  status: string;
  locationId: string;
  tableId: string | null;
  guestCount: number;
  startsAt: string;
  endsAt: string;
  customerName: string;
};

export type ReservationDetail = ReservationSummary & {
  contactId: string | null;
  assignedUserId: string | null;
  source: string;
  durationMinutes: number;
  customerPhone: string | null;
  customerEmail: string | null;
  customerNote: string | null;
};

export type StatusHistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
};

export type Venue = {
  id: string;
  name: string;
  timezone: string;
};

export type DiningTable = {
  id: string;
  locationId: string;
  name: string;
  minCapacity: number;
  capacity: number;
};

export type ReservationFilters = {
  fromDay: string;
  toDay: string;
  status: string;
  locationId: string;
  assigneeId: string;
  search: string;
  cursor: string | null;
};

type Role = SessionPrincipal['user']['role'];

/** Mirrors the API role map: every workspace role may create and update reservations. */
export function canCreateReservation(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
}

/** Mirrors the API role map: every workspace role may update reservations. */
export function canUpdateReservation(role: Role): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER';
}

export function allowedActions(status: string): ReservationTransitionAction[] {
  if (status === 'PENDING') return ['confirm'];
  if (status === 'CONFIRMED') return ['arrive', 'no-show'];
  if (status === 'ARRIVED') return ['seat'];
  if (status === 'SEATED') return ['complete'];
  return [];
}

export function canEditReservation(status: string): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

export function canCancelReservation(status: string): boolean {
  return status === 'PENDING' || status === 'CONFIRMED' || status === 'ARRIVED';
}

export function todayInput(): string {
  return dateInput(new Date());
}

export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return dateInput(date);
}

/** Inclusive local dates as `[from, to)` instants, matching the list query. */
export function rangeBounds(fromDay: string, toDay: string): { from: string; to: string } {
  const endDay = toDay < fromDay ? fromDay : toDay;
  const start = new Date(`${fromDay}T00:00:00`);
  const end = new Date(`${endDay}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function hourOf(iso: string): number {
  return new Date(iso).getHours();
}

function dateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
