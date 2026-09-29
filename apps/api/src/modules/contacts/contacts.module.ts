import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { CreateContactService } from './application/create-contact.service';

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [CreateContactService],
})
export class ContactsModule {}
