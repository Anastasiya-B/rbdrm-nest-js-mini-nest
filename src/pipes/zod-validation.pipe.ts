import type { ZodType } from 'zod';

import type { Pipe } from '../lifecycle';

export interface ValidationErrorDetail {
  field: string;
  constraints: string[];
}

export class ValidationError extends Error {
  constructor(public readonly errors: ValidationErrorDetail[]) {
    super('Validation failed');

    this.name = 'ValidationError';
  }
}

export class ZodValidationPipe implements Pipe {
  transform(value: unknown, schema?: ZodType): unknown {
    if (!schema) {
      return value;
    }

    const result = schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new ValidationError(
      result.error.issues.map(issue => ({
        field: issue.path.join('.') || 'body',
        constraints: [issue.message],
      })),
    );
  }
}
