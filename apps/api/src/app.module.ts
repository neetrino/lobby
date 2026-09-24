import { Module } from '@nestjs/common';

import { ContactsModule } from './modules/contacts';
import { DealsModule } from './modules/deals';
import { HealthModule } from './modules/health/health.module';
import { MessengerModule } from './modules/messenger';

@Module({
  imports: [HealthModule, ContactsModule, DealsModule, MessengerModule],
})
export class AppModule {}
