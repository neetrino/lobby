import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ValidationError } from '../http/validation-error';

/**
 * Parses one input with a Zod schema.
 * Bind it through `ZodBody`, `ZodQuery`, or `ZodParam` so every controller uses the same error shape.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(fieldPaths(result.error.issues));
    }
    return result.data;
  }
}

type SchemaIssue = {
  path: readonly PropertyKey[];
  code?: string;
  keys?: readonly unknown[];
};

function fieldPaths(issues: readonly SchemaIssue[]): { path: string }[] {
  const fields: { path: string }[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    for (const path of pathsFor(issue)) {
      if (seen.has(path)) {
        continue;
      }
      seen.add(path);
      fields.push({ path });
    }
  }
  return fields;
}

function pathsFor(issue: SchemaIssue): readonly string[] {
  const extras = unrecognizedKeys(issue);
  if (extras.length > 0) {
    return extras.map((key) => joinPath(issue.path, key));
  }
  return [joinPath(issue.path)];
}

function unrecognizedKeys(issue: SchemaIssue): readonly string[] {
  if (issue.code !== 'unrecognized_keys' || !Array.isArray(issue.keys)) {
    return [];
  }
  return issue.keys.filter((key): key is string => typeof key === 'string');
}

function joinPath(path: readonly PropertyKey[], extra?: string): string {
  const segments = path.map((segment) => String(segment));
  if (extra !== undefined) {
    segments.push(extra);
  }
  return segments.length === 0 ? '(root)' : segments.join('.');
}
