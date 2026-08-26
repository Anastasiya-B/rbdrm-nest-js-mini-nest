import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

type Constructor<T = unknown> = new (...args: any[]) => T;

export interface ValidationErrorDetail {
  field: string;
  constraints: Record<string, string>;
}

export class ValidationException extends Error {
  constructor(public readonly errors: ValidationErrorDetail[]) {
    super('Validation failed');
  }
}

const mapValidationErrors = (
  errors: ValidationError[],
): ValidationErrorDetail[] => {
  return errors.map(error => ({
    field: error.property,
    constraints: error.constraints ?? {},
  }));
};

export class ValidationPipe {
  async transform<T>(value: unknown, metatype: Constructor<T>): Promise<T> {
    const instance = plainToInstance(metatype, value);

    const errors = await validate(instance as object);

    if (errors.length > 0) {
      throw new ValidationException(mapValidationErrors(errors));
    }

    return instance;
  }
}
