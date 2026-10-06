import { readFileSync } from 'node:fs';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  requestContextFromSession,
  type RequestContext,
} from '../../../common/tenant/request-context';
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import { ContactRepository } from './contact.repository';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTestTenantData(prisma);
});

describe('ContactRepository', () => {
  it('keeps a contact inside the tenant that opened the repository', async () => {
    const owner = await createTenant('owner');
    const other = await createTenant('other');
    const repository = new ContactRepository(prisma);
    const created = await repository.forTenant(requestContext(owner.id, owner.userId)).create({
      name: 'Ada',
      type: 'PERSON',
      email: null,
      phone: null,
      createdByUserId: owner.userId,
      ownerUserId: owner.userId,
    });

    const foreign = repository.forTenant(requestContext(other.id, other.userId));
    expect(await foreign.findById(created.id)).toBeNull();
    expect(await foreign.update(created.id, { name: 'Stolen' })).toBe(0);

    const stored = await repository
      .forTenant(requestContext(owner.id, owner.userId))
      .findById(created.id);
    expect(stored).toMatchObject({ id: created.id, tenantId: owner.id, name: 'Ada' });
  });

  it('does not let contact services query the contact table directly', () => {
    const repository = readFileSync(new URL('./contact.repository.ts', import.meta.url), 'utf8');
    const createService = readFileSync(
      new URL('../application/create-contact.service.ts', import.meta.url),
      'utf8',
    );
    const accessService = readFileSync(
      new URL('../application/contact-access.service.ts', import.meta.url),
      'utf8',
    );

    const queries = classBody(repository, 'ContactQueries');
    const operations = methodNames(queries);
    expect(operations.sort()).toEqual(typeMethodNames(repository, 'ContactOperations').sort());
    for (const operation of operations) {
      expect(methodBody(queries, operation), operation).toContain('this.tenantId');
    }
    expect(methodBody(classBody(repository, 'TenantContactScope'), 'transaction')).toContain(
      'this.tenantId',
    );
    expect(createService).not.toContain('.contact.');
    expect(accessService).not.toContain('.contact.');
  });
});

/** Source of one class, through the following class declaration. */
function classBody(source: string, className: string): string {
  const start = source.indexOf(`class ${className}`);
  expect(start, className).toBeGreaterThan(-1);
  const next = source.indexOf('\nclass ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

/** Public methods declared on a class body. */
function methodNames(body: string): string[] {
  return [...body.matchAll(/\n  (?!private |constructor)(?:async )?([A-Za-z0-9_]+)\(/g)].map(
    (match) => match[1] ?? '',
  );
}

/** Method names declared on an exported operation type. */
function typeMethodNames(source: string, typeName: string): string[] {
  const start = source.indexOf(`export type ${typeName} = {`);
  expect(start, typeName).toBeGreaterThan(-1);
  const end = source.indexOf('\n};', start);
  const body = source.slice(start, end === -1 ? source.length : end);
  return [...body.matchAll(/\n  ([A-Za-z0-9_]+)\(/g)].map((match) => match[1] ?? '');
}

/** One method, from its signature through the line before the next method. */
function methodBody(body: string, methodName: string): string {
  const signature = new RegExp(`\\n  (?:async )?${methodName}(?:<[^>]+>)?\\(`);
  const start = body.search(signature);
  expect(start, methodName).toBeGreaterThan(-1);
  const fromMethod = body.slice(start + 1);
  const lineBreak = fromMethod.indexOf('\n');
  const next = fromMethod.slice(lineBreak + 1).search(/\n  (?:async )?[A-Za-z]/);
  const end = next === -1 ? body.length : start + 1 + lineBreak + 1 + next;
  return body.slice(start, end);
}

function requestContext(tenantId: string, userId: string): RequestContext {
  return requestContextFromSession(
    {
      tenantId,
      userId,
      role: 'OWNER',
    },
    '44444444-4444-4444-8444-444444444444',
  );
}

async function createTenant(subdomain: string) {
  const tenant = await prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `${subdomain}@example.com`,
      name: subdomain,
      passwordHash: 'hash',
      role: 'OWNER',
    },
  });
  return { id: tenant.id, userId: user.id };
}
