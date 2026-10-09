import { Controller, Get, NotFoundException, Post, Res } from '@nestjs/common';
import type { CreateReservationInput, CursorPage } from '@lobby/contracts';
import { createReservationSchema } from '@lobby/contracts';
import { z } from 'zod';

type StatusResponse = { status(code: number): void };

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam, ZodQuery } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { CreateReservationService } from '../application/create-reservation.service';
import { ReservationAccessService } from '../application/reservation-access.service';
import {
  reservationListQuerySchema,
  type ReservationListQuery,
} from '../application/list-reservations.schema';
import { toReservationView, type ReservationView } from './reservation-view';

type ReservationResponse = {
  data: ReservationView;
  meta: { replayed: boolean };
};

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationService,
    private readonly access: ReservationAccessService,
  ) {}

  @Get()
  @Authorize('reservations:read')
  async list(
    @CurrentRequest() context: RequestContext,
    @ZodQuery(reservationListQuerySchema) query: ReservationListQuery,
  ): Promise<CursorPage<ReservationView>> {
    const page = await this.access.list(context, query);
    return { data: page.data.map(toReservationView), page: page.page };
  }

  @Get(':id')
  @Authorize('reservations:read')
  async read(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', z.uuid()) id: string,
  ): Promise<{ data: ReservationView }> {
    const reservation = await this.access.read(context, id);
    if (reservation === null) throw new NotFoundException();
    return { data: toReservationView(reservation) };
  }

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
