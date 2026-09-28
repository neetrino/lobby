import 'reflect-metadata';
import { Inject, Injectable, Logger, Module, type Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OutboxModule } from '../outbox/outbox.module';
import { OutboxService } from '../outbox/outbox.service';
import { DatabaseModule } from './database.module';
import { PRISMA_CLIENT } from './database.tokens';

type DisconnectableClient = {
  $disconnect: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

@Injectable()
class ReaderA {
  constructor(@Inject(PRISMA_CLIENT) readonly prisma: DisconnectableClient) {}
}

@Injectable()
class ReaderB {
  constructor(@Inject(PRISMA_CLIENT) readonly prisma: DisconnectableClient) {}
}

@Module({
  imports: [DatabaseModule],
  providers: [ReaderA],
})
class DatabaseOnlyModule {}

@Module({
  imports: [DatabaseModule],
  providers: [ReaderA],
})
class FirstConsumerModule {}

@Module({
  imports: [DatabaseModule],
  providers: [ReaderB],
})
class SecondConsumerModule {}

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [ReaderA],
})
class OutboxConsumerModule {}

@Module({
  imports: [OutboxModule],
  providers: [ReaderA],
})
class OutboxWithoutDatabaseExportModule {}

function disconnectableClient(disconnect: () => Promise<void> = () => Promise.resolve()): DisconnectableClient {
  return { $disconnect: vi.fn(disconnect) };
}

function compileWithClient(client: DisconnectableClient, modules: Type[]): Promise<TestingModule> {
  return Test.createTestingModule({ imports: modules })
    .overrideProvider(PRISMA_CLIENT)
    .useFactory({ factory: () => client })
    .compile();
}

describe('DatabaseModule', () => {
  const modules: TestingModule[] = [];

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((moduleRef) => moduleRef.close()));
  });

  it('provides PRISMA_CLIENT from DatabaseModule without OutboxModule', async () => {
    const client = disconnectableClient();
    const moduleRef = await compileWithClient(client, [DatabaseOnlyModule]);
    modules.push(moduleRef);

    expect(moduleRef.select(DatabaseOnlyModule).get(ReaderA).prisma).toBe(client);
    expect(moduleRef.select(DatabaseOnlyModule).get(PRISMA_CLIENT)).toBe(client);
  });

  it('shares one Prisma client across modules', async () => {
    let created = 0;
    const client = disconnectableClient();
    const moduleRef = await Test.createTestingModule({
      imports: [FirstConsumerModule, SecondConsumerModule],
    })
      .overrideProvider(PRISMA_CLIENT)
      .useFactory({
        factory: () => {
          created += 1;
          return client;
        },
      })
      .compile();
    modules.push(moduleRef);

    const first = moduleRef.select(FirstConsumerModule).get(ReaderA).prisma;
    const second = moduleRef.select(SecondConsumerModule).get(ReaderB).prisma;
    expect(first).toBe(second);
    expect(created).toBe(1);
  });

  it('disconnects once when Nest shuts the module down', async () => {
    const client = disconnectableClient();
    const moduleRef = await compileWithClient(client, [DatabaseModule]);
    const database = moduleRef.get(DatabaseModule);

    await moduleRef.close();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);

    await database.onModuleDestroy();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not throw when disconnect fails because the client is already closed', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const client = disconnectableClient(() => Promise.reject(new Error('already disconnected')));
      const moduleRef = await compileWithClient(client, [DatabaseModule]);
      modules.push(moduleRef);
      const database = moduleRef.get(DatabaseModule);

      await expect(database.onModuleDestroy()).resolves.toBeUndefined();
      await expect(database.onModuleDestroy()).resolves.toBeUndefined();
      expect(client.$disconnect).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('compiles OutboxModule without exporting the Prisma client', async () => {
    const client = disconnectableClient();
    const moduleRef = await compileWithClient(client, [OutboxConsumerModule]);
    modules.push(moduleRef);

    expect(moduleRef.select(OutboxConsumerModule).get(OutboxService)).toBeInstanceOf(OutboxService);
    expect(moduleRef.select(OutboxConsumerModule).get(ReaderA).prisma).toBe(client);

    await expect(compileWithClient(client, [OutboxWithoutDatabaseExportModule])).rejects.toThrow(/PRISMA_CLIENT/);
  });
});
