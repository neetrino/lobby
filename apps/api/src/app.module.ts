import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { ALLOWED_ORIGINS, readAllowedOrigins } from './common/security/allowed-origins';
import { OriginGuard } from './common/security/origin.guard';
import { ContactsModule } from './modules/contacts';
import { DealsModule } from './modules/deals';
import { HealthModule } from './modules/health';
import { IdentityModule, SessionGuard } from './modules/identity';
import { MessengerModule } from './modules/messenger';
import { OrganizationsModule } from './modules/organizations';
import { ReservationsModule } from './modules/reservations';

@Module({
  imports: [
    HealthModule,
    IdentityModule,
    OrganizationsModule,
    ContactsModule,
    DealsModule,
    MessengerModule,
    ReservationsModule,
  ],
  providers: [
    { provide: ALLOWED_ORIGINS, useFactory: () => readAllowedOrigins() },
    // Registration order is the runtime order: OriginGuard, then SessionGuard.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
