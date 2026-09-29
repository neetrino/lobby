import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { ContactAccessService } from './application/contact-access.service';
import { CreateContactService } from './application/create-contact.service';

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [CreateContactService, ContactAccessService],
})
export class ContactsModule {}
