import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodParam, ZodQuery } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ReservationAccessService } from '../application/reservation-access.service';
import {
  availabilityQuerySchema,
  type AvailabilityQuery,
} from '../application/reservation-read.schema';

@Controller('reservation-locations')
export class ReservationLocationsController {
  constructor(private readonly access: ReservationAccessService) {}

  @Get()
  @Authorize('reservations:read')
  async list(@CurrentRequest() context: RequestContext) {
    const locations = await this.access.locations(context);
    return {
      data: locations.map((location) => ({ ...location })),
    };
  }

  @Get(':locationId/tables')
  @Authorize('reservations:read')
  async tables(
    @CurrentRequest() context: RequestContext,
    @ZodParam('locationId', z.uuid()) locationId: string,
  ) {
    const tables = await this.access.tables(context, locationId);
    return {
      data: tables.map(toTableView),
    };
  }
}

@Controller('reservation-availability')
export class ReservationAvailabilityController {
  constructor(private readonly access: ReservationAccessService) {}

  @Get()
  @Authorize('reservations:read')
  async read(
    @CurrentRequest() context: RequestContext,
    @ZodQuery(availabilityQuerySchema) query: AvailabilityQuery,
  ) {
    const tables = await this.access.availability(context, query);
    return {
      data: {
        available: tables.length > 0,
        tables: tables.map(toTableView),
      },
    };
  }
}

function toTableView(table: {
  id: string;
  locationId: string;
  name: string;
  minCapacity: number;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
}) {
  return {
    id: table.id,
    locationId: table.locationId,
    name: table.name,
    minCapacity: table.minCapacity,
    capacity: table.capacity,
    status: table.status,
  };
}
