import { Controller, Post, Res } from '@nestjs/common';
import type { CreateReservationInput } from '@lobby/contracts';
import { createReservationSchema } from '@lobby/contracts';

type StatusResponse = { status(code: number): void };

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { CreateReservationService } from '../application/create-reservation.service';
import { toReservationView, type ReservationView } from './reservation-view';

type ReservationResponse = {
  data: ReservationView;
  meta: { replayed: boolean };
};

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly createReservation: CreateReservationService) {}

  @Post()
  @Authorize('reservations:create')
  async create(
    @CurrentRequest() context: RequestContext,
    @ZodBody(createReservationSchema) body: CreateReservationInput,
    @Res({ passthrough: true }) response: StatusResponse,
  ): Promise<ReservationResponse> {
    const created = await this.createReservation.create({ type: 'USER', context }, body);
    response.status(created.replayed ? 200 : 201);
    return { data: toReservationView(created.reservation), meta: { replayed: created.replayed } };
  }
}
