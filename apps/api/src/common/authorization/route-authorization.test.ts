import 'reflect-metadata';
import { Controller, Get, Post } from '@nestjs/common';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { IS_PUBLIC_KEY, Public } from '../auth/public';
import { PERMISSIONS_KEY, PermissionGuard } from './permission.guard';

const METHOD_METADATA = 'method';
const GUARDS_METADATA = '__guards__';

/**
 * The caller's own session. These routes stay authenticated and do not declare a module permission.
 * Any other non-public handler must use @Authorize.
 */
const callerSessionRoutes = new Set([
  'SessionController.session',
  'SessionController.terminateAll',
]);

describe('route authorization', () => {
  it('requires @Authorize on every protected business route', async () => {
    const controllers = await loadControllers();
    const gaps = controllers.flatMap(authorizationGaps);

    expect(controllers.map((controller) => controller.name).sort()).toEqual([
      'AuditEventsController',
      'AuthController',
      'ContactsController',
      'HealthController',
      'SessionController',
    ]);
    expect(gaps).toEqual([]);
  });

  it('reports a business route that forgot @Authorize', () => {
    expect(authorizationGaps(UnguardedController)).toEqual(['UnguardedController.create']);
  });
});

@Controller('unguarded')
class UnguardedController {
  @Post()
  create(): void {}

  @Public()
  @Get('open')
  open(): void {}
}

function authorizationGaps(controller: new (...args: never[]) => object): string[] {
  const gaps: string[] = [];
  for (const route of routeHandlers(controller)) {
    const id = `${controller.name}.${route.name}`;
    if (isPublic(route.handler, controller) || callerSessionRoutes.has(id)) {
      continue;
    }
    if (!hasAuthorize(route.handler)) {
      gaps.push(id);
    }
  }
  return gaps;
}

function hasAuthorize(handler: object): boolean {
  const permission = Reflect.getMetadata(PERMISSIONS_KEY, handler) as unknown;
  const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;
  return (
    typeof permission === 'string' &&
    permission.length > 0 &&
    guards?.includes(PermissionGuard) === true
  );
}

function isPublic(handler: object, controller: new (...args: never[]) => object): boolean {
  return (
    Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
    Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true
  );
}

function routeHandlers(
  controller: new (...args: never[]) => object,
): Array<{ name: string; handler: object }> {
  const prototype: object = controller.prototype;
  return Object.getOwnPropertyNames(prototype).flatMap((name) => {
    if (name === 'constructor') {
      return [];
    }
    const handler: unknown = prototype[name as keyof typeof prototype];
    if (
      typeof handler !== 'function' ||
      Reflect.getMetadata(METHOD_METADATA, handler) === undefined
    ) {
      return [];
    }
    return [{ name, handler }];
  });
}

async function loadControllers(): Promise<Array<new (...args: never[]) => object>> {
  const files = controllerFiles(join(process.cwd(), 'src'));
  const controllers: Array<new (...args: never[]) => object> = [];
  for (const file of files) {
    const imported = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    for (const value of Object.values(imported)) {
      if (isController(value)) {
        controllers.push(value);
      }
    }
  }
  return controllers;
}

function controllerFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return controllerFiles(path);
    }
    return entry.endsWith('.controller.ts') ? [path] : [];
  });
}

function isController(value: unknown): value is new (...args: never[]) => object {
  return typeof value === 'function' && Reflect.getMetadata('path', value) !== undefined;
}
