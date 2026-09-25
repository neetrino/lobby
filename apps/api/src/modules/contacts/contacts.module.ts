import { Module } from '@nestjs/common';

import { OutboxModule } from '../../common/outbox';
import { CreateContactService } from './application/create-contact.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [OutboxModule],
  controllers: [ContactsController],
  providers: [ContactsService, CreateContactService],
})
export class ContactsModule {}
