import { Controller, Get, HttpCode, NotFoundException, Patch, Post, Res } from '@nestjs/common';
import type {
  CancelReservationInput,
  CreateReservationInput,
  CursorPage,
  UpdateReservationInput,
} from '@lobby/contracts';
import {
  cancelReservationSchema,
  createReservationSchema,
  reservationTransitionActionSchema,
  transitionReservationSchema,
  updateReservationSchema,
  type ReservationTransitionAction,
  type TransitionReservationInput,
} from '@lobby/contracts';
import { z } from 'zod';

type StatusResponse = { status(code: number): void };

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam, ZodQuery } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { CreateReservationService } from '../application/create-reservation.service';
import { ReservationAccessService } from '../application/reservation-access.service';
import { ReservationLifecycleService } from '../application/reservation-lifecycle.service';
import {
  reservationListQuerySchema,
  type ReservationListQuery,
} from '../application/list-reservations.schema';
import {
  toReservationDetailView,
  toReservationView,
  type ReservationDetailView,
  type ReservationView,
} from './reservation-view';

type ReservationResponse = {
  data: ReservationView;
  meta: { replayed: boolean };
};

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationService,
    private readonly access: ReservationAccessService,
    private readonly lifecycle: ReservationLifecycleService,
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
  ): Promise<{ data: ReservationDetailView }> {
    const reservation = await this.access.read(context, id);
    if (reservation === null) throw new NotFoundException();
    return { data: toReservationDetailView(reservation) };
  }

  @Get(':id/history')
  @Authorize('reservations:read')
  async history(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', z.uuid()) id: string,
  ) {
    const history = await this.access.history(context, id);
    return {
      data: history.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  @Patch(':id')
  @Authorize('reservations:update')
  async update(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', z.uuid()) id: string,
    @ZodBody(updateReservationSchema) body: UpdateReservationInput,
  ): Promise<{ data: ReservationView }> {
    return { data: toReservationView(await this.lifecycle.update(context, id, body)) };
  }

  @Post(':id/cancel')
  @Authorize('reservations:update')
  @HttpCode(200)
  async cancel(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', z.uuid()) id: string,
    @ZodBody(cancelReservationSchema) body: CancelReservationInput,
  ): Promise<{ data: ReservationView }> {
    return { data: toReservationView(await this.lifecycle.cancel(context, id, body)) };
  }

  @Post(':id/transitions/:action')
  @Authorize('reservations:update')
  @HttpCode(200)
  async transition(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', z.uuid()) id: string,
    @ZodParam('action', reservationTransitionActionSchema) action: ReservationTransitionAction,
    @ZodBody(transitionReservationSchema) body: TransitionReservationInput,
  ): Promise<{ data: ReservationView }> {
    return { data: toReservationView(await this.lifecycle.transition(context, id, action, body)) };
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
