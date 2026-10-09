const reservationErrorSpecs = {
  RESERVATION_LOCATION_NOT_FOUND: {
    statusCode: 404,
    message: 'The reservation location was not found.',
  },
  RESERVATION_TABLE_NOT_FOUND: {
    statusCode: 404,
    message: 'The reservation table was not found.',
  },
  RESERVATION_TABLE_CAPACITY_EXCEEDED: {
    statusCode: 409,
    message: 'The table cannot seat this party.',
  },
  RESERVATION_OUTSIDE_WORKING_HOURS: {
    statusCode: 409,
    message: 'The reservation is outside working hours.',
  },
  RESERVATION_TIME_CONFLICT: {
    statusCode: 409,
    message: 'That table is already booked for this time.',
  },
  RESERVATION_SOURCE_CONFLICT: {
    statusCode: 409,
    message: 'This source request was already used for a different reservation.',
  },
  RESERVATION_CONTACT_NOT_FOUND: {
    statusCode: 404,
    message: 'The contact was not found.',
  },
  RESERVATION_ASSIGNEE_NOT_FOUND: {
    statusCode: 404,
    message: 'The assigned user was not found.',
  },
  RESERVATION_MODULE_DISABLED: {
    statusCode: 403,
    message: 'This module is not enabled.',
  },
  RESERVATION_START_NOT_IN_FUTURE: {
    statusCode: 409,
    message: 'The reservation must start in the future.',
  },
  RESERVATION_NOT_FOUND: {
    statusCode: 404,
    message: 'The reservation was not found.',
  },
  RESERVATION_NOT_EDITABLE: {
    statusCode: 409,
    message: 'The reservation can no longer be changed.',
  },
  RESERVATION_INVALID_TRANSITION: {
    statusCode: 409,
    message: 'This status change is not allowed.',
  },
} as const;

export type ReservationErrorCode = keyof typeof reservationErrorSpecs;

/** Stable booking failure. The message does not include caller data. */
export class ReservationFailure extends Error {
  readonly code: ReservationErrorCode;
  readonly statusCode: number;

  constructor(code: ReservationErrorCode) {
    const spec = reservationErrorSpecs[code];
    super(spec.message);
    this.name = 'ReservationFailure';
    this.code = code;
    this.statusCode = spec.statusCode;
  }
}

export function isReservationFailure(
  exception: unknown,
): exception is ReservationFailure {
  return exception instanceof ReservationFailure;
}
