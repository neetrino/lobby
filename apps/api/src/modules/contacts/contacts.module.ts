import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { ContactAccessService } from './application/contact-access.service';
import { ContactLifecycleService } from './application/contact-lifecycle.service';
import { ContactsDashboardProjection } from './application/contacts-dashboard.projection';
import { ContactsReadService } from './application/contacts-read.service';
import { CreateContactService } from './application/create-contact.service';
import { ContactRepository } from './infrastructure/contact.repository';
import { ContactsDashboardQuery } from './infrastructure/contacts-dashboard.query';
import { ContactsController } from './presentation/contacts.controller';

@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule, AuditModule],
  controllers: [ContactsController],
  providers: [
    ContactRepository,
    CreateContactService,
    ContactAccessService,
    ContactLifecycleService,
    ContactsReadService,
    ContactsDashboardQuery,
    ContactsDashboardProjection,
  ],
  exports: [ContactsReadService, ContactsDashboardProjection],
})
export class ContactsModule {}
