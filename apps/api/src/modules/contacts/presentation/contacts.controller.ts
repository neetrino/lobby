import { Controller, Get, HttpCode, NotFoundException, Patch, Post } from '@nestjs/common';
import type { CursorPage } from '@lobby/contracts';
import { z } from 'zod';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam, ZodQuery } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactAccessService } from '../application/contact-access.service';
import { ContactLifecycleService } from '../application/contact-lifecycle.service';
import { createContactSchema, type CreateContactInput } from '../application/create-contact.schema';
import { CreateContactService } from '../application/create-contact.service';
import { contactListQuerySchema, type ContactListQuery } from '../application/list-contacts.schema';
import { updateContactSchema, type UpdateContactInput } from '../application/update-contact.schema';
import {
  contactResponse,
  toContactView,
  type ContactResponse,
  type ContactView,
} from './contact-view';

const contactIdSchema = z.uuid();

@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly createContact: CreateContactService,
    private readonly access: ContactAccessService,
    private readonly lifecycle: ContactLifecycleService,
  ) {}

  @Post()
  @Authorize('contacts:create')
  @HttpCode(201)
  async create(
    @CurrentRequest() context: RequestContext,
    @ZodBody(createContactSchema) body: CreateContactInput,
  ): Promise<ContactResponse> {
    const created = await this.createContact.create(context, body);
    return contactResponse(created.contact, created.warnings);
  }

  @Get()
  @Authorize('contacts:read')
  async list(
    @CurrentRequest() context: RequestContext,
    @ZodQuery(contactListQuerySchema) query: ContactListQuery,
  ): Promise<CursorPage<ContactView>> {
    const page = await this.access.list(context, query);
    return { data: page.data.map(toContactView), page: page.page };
  }

  @Get('summary')
  @Authorize('contacts:read')
  async summary(@CurrentRequest() context: RequestContext): Promise<{ data: { active: number } }> {
    return { data: { active: await this.access.activeCount(context) } };
  }

  @Get(':id')
  @Authorize('contacts:read')
  async read(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
  ): Promise<{ data: ContactView }> {
    return { data: await this.requireContact(context, id) };
  }

  @Patch(':id')
  @Authorize('contacts:update')
  async update(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
    @ZodBody(updateContactSchema) body: UpdateContactInput,
  ): Promise<ContactResponse> {
    const updated = await this.access.update(context, id, body);
    if (updated === null) {
      throw new NotFoundException();
    }
    return contactResponse(updated.contact, updated.warnings);
  }

  @Post(':id/archive')
  @Authorize('contacts:update')
  @HttpCode(200)
  async archive(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
  ): Promise<{ data: ContactView }> {
    return { data: await this.requireLifecycle(context, id, true) };
  }

  @Post(':id/restore')
  @Authorize('contacts:update')
  @HttpCode(200)
  async restore(
    @CurrentRequest() context: RequestContext,
    @ZodParam('id', contactIdSchema) id: string,
  ): Promise<{ data: ContactView }> {
    return { data: await this.requireLifecycle(context, id, false) };
  }

  private async requireContact(context: RequestContext, id: string): Promise<ContactView> {
    const contact = await this.access.read(context, id);
    if (contact === null) {
      throw new NotFoundException();
    }
    return toContactView(contact);
  }

  private async requireLifecycle(
    context: RequestContext,
    id: string,
    archive: boolean,
  ): Promise<ContactView> {
    const contact = archive
      ? await this.lifecycle.archive(context, id)
      : await this.lifecycle.restore(context, id);
    if (contact === null) {
      throw new NotFoundException();
    }
    return toContactView(contact);
  }
}
