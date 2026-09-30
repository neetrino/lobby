import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { ContactAccessService } from './application/contact-access.service';
import { CreateContactService } from './application/create-contact.service';
import { ContactRepository } from './infrastructure/contact.repository';
import { ContactsController } from './presentation/contacts.controller';

@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule],
  controllers: [ContactsController],
  providers: [ContactRepository, CreateContactService, ContactAccessService],
})
export class ContactsModule {}
