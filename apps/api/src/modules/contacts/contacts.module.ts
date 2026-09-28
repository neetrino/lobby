import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { CreateContactService } from './application/create-contact.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [DatabaseModule, OutboxModule],
  controllers: [ContactsController],
  providers: [ContactsService, CreateContactService],
})
export class ContactsModule {}
