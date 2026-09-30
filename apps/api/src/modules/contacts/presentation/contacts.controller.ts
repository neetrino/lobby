import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentRequest } from '../../../common/auth/current-request';
import { ZodBody, ZodParam } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { SessionGuard } from '../../identity';
import { ContactAccessService, type ContactRecord } from '../application/contact-access.service';
import {
  createContactSchema,
  type CreateContactInput,
} from '../application/create-contact.schema';
import { CreateContactService } from '../application/create-contact.service';
import { renameContactSchema, type RenameContactInput } from '../application/rename-contact.schema';

const contactIdSchema = z.uuid();

type ContactView = {
  id: string;
  name: string;
};

@Controller('contacts')
@UseGuards(SessionGuard)
export class ContactsController {
  constructor(
    private readonly createContact: CreateContactService,
    private readonly access: ContactAccessService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @CurrentRequest() context: RequestContext,
    @ZodBody(createContactSchema) body: CreateContactInput,
  ): Promise<{ data: ContactView }> {
    const created = await this.createContact.create(context, body);
    return { data: toContactView(created) };
  }

  @Get(':id')
  async read(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
  ): Promise<{ data: ContactView }> {
    return { data: await this.requireContact(context, id) };
  }

  @Patch(':id')
  async rename(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
    @ZodBody(renameContactSchema) body: RenameContactInput,
  ): Promise<{ data: ContactView }> {
    const renamed = await this.access.rename(context, id, body);
    if (renamed === null) {
      throw new NotFoundException();
    }
    return { data: toContactView(renamed) };
  }

  private async requireContact(context: RequestContext, id: string): Promise<ContactView> {
    const contact = await this.access.read(context, id);
    if (contact === null) {
      throw new NotFoundException();
    }
    return toContactView(contact);
  }
}

function toContactView(contact: Pick<ContactRecord, 'id' | 'name'>): ContactView {
  return { id: contact.id, name: contact.name };
}
